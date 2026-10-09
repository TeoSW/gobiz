"""Generate the SkillSync presentation: screenshots, a PDF deck and a 30-second demo video (no captions).

Requires the app running on http://localhost:8080 (docker compose up), Playwright (Apache-2.0) and
imageio-ffmpeg (BSD-2, ships an LGPL/GPL ffmpeg build with libx264):
    pip install playwright imageio-ffmpeg
    python -m playwright install chromium
    python docs/presentation/make_presentation.py

Outputs (next to this file): screens/*.png, SkillSync-presentation.pdf, SkillSync-demo.mp4.
The demo data is reset before and after, so the run leaves the app as it was.
"""

import asyncio
import base64
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import imageio_ffmpeg
from playwright.async_api import async_playwright
from playwright.sync_api import Page, sync_playwright

BASE = "http://localhost:8080"
OUT = Path(__file__).resolve().parent
SHOTS = OUT / "screens"
ROOT = OUT.parents[1]
BRAND = ROOT / "docs/brand"
FONT = ROOT / "frontend/node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2"
FONT_EXT = ROOT / "frontend/node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-ext-wght-normal.woff2"
VIDEO_SECONDS = 30
# the app is bilingual (RO/EN); the script clicks English labels, so it always records the English UI
ENGLISH_UI = "try { localStorage.setItem('skillsync-lang', 'en'); } catch (e) {}"


def api(path: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode() if body is not None else b""
    req = urllib.request.Request(f"{BASE}/api{path}", data=data, method="POST", headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=60).read() or b"{}")


def reset_demo() -> None:
    api("/system/reset-demo")


def login(page: Page, name: str) -> None:
    page.goto(f"{BASE}/login")
    page.get_by_role("button", name=re.compile(f"Log in as {name}")).click()


def logout(page: Page) -> None:
    page.get_by_role("button", name="Log out").click()
    page.wait_for_url("**/login")


# ---------------------------------------------------------------- 1. screenshots for the PDF
def take_screenshots(browser) -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob("*.png"):
        old.unlink()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    # the sticky header would cover the top of element screenshots
    ctx.add_init_script("document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style');"
                        " s.textContent = 'header { position: relative !important; }'; document.head.appendChild(s); })")
    ctx.add_init_script(ENGLISH_UI)
    page = ctx.new_page()

    page.goto(BASE)
    page.wait_for_selector("text=How it works")
    page.wait_for_timeout(600)
    page.screenshot(path=SHOTS / "01-home.png")

    page.goto(f"{BASE}/login")
    page.get_by_role("button", name=re.compile("Log in as Test Student")).wait_for()
    page.screenshot(path=SHOTS / "02-login.png")
    page.get_by_role("button", name=re.compile("Log in as Test Student")).click()
    page.wait_for_selector("text=Recommended for you")
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / "03-student-dashboard.png")

    page.goto(f"{BASE}/match")
    page.get_by_role("button", name=re.compile("I'm interested")).wait_for()
    page.wait_for_timeout(1000)
    page.screenshot(path=SHOTS / "04-swipe-student.png")
    page.keyboard.press("ArrowRight")  # Test SRL already liked Test Student for this project
    page.wait_for_selector("#match-title")
    page.wait_for_timeout(1600)  # celebration animation
    page.screenshot(path=SHOTS / "05-its-a-match.png")
    page.get_by_role("button", name="Keep swiping").click()

    page.goto(f"{BASE}/explore?type=internship")
    page.get_by_role("link", name=re.compile("Data analyst internship")).click()
    fit = page.locator("div.card", has=page.get_by_role("heading", name="How well you fit"))
    fit.wait_for()
    page.wait_for_timeout(500)
    fit.screenshot(path=SHOTS / "06-why-fit.png")  # collapsed: the plain-language part only

    page.goto(f"{BASE}/student/profile")
    page.locator("section", has=page.get_by_role("heading", name="Your CV")).wait_for()
    page.screenshot(path=SHOTS / "07-cv.png")
    logout(page)

    login(page, "Test SRL")
    page.wait_for_url("**/company")
    page.goto(f"{BASE}/company/new")
    page.get_by_role("button", name="Fill with an example").click()
    page.get_by_role("button", name="Analyze with AI").click()
    page.wait_for_selector("text=Extracted by", timeout=180_000)
    page.wait_for_timeout(500)
    skills = page.locator("div.card", has=page.get_by_role("heading", name="Skills", exact=True))
    skills.screenshot(path=SHOTS / "08-ai-extraction.png")

    page.goto(f"{BASE}/match")
    page.get_by_role("button", name=re.compile("Interested in this student")).wait_for()
    page.wait_for_timeout(1000)
    page.screenshot(path=SHOTS / "09-swipe-company.png")

    page.goto(f"{BASE}/company")
    page.get_by_role("link", name=re.compile("New design for our online shop")).click()
    cands = page.locator("section", has=page.get_by_role("heading", name="Candidates"))
    cands.wait_for()
    page.wait_for_timeout(1500)
    cands.screenshot(path=SHOTS / "10-candidates.png")
    logout(page)

    login(page, "Test Professor")
    page.wait_for_selector("text=University insights")
    page.wait_for_timeout(2500)  # chart animation
    page.screenshot(path=SHOTS / "11-insights.png")
    ctx.close()


# ---------------------------------------------------------------- 2. PDF deck
def img(name: str) -> str:
    return "data:image/png;base64," + base64.b64encode((SHOTS / name).read_bytes()).decode()


def svg(name: str) -> str:
    return "data:image/svg+xml;base64," + base64.b64encode((BRAND / name).read_bytes()).decode()


def slide(title: str, body: str = "", shot: str | None = None, kicker: str = "") -> str:
    right = f'<div class="shot"><img src="{img(shot)}"></div>' if shot else ""
    cls = "slide split" if shot else "slide"
    return f'<section class="{cls}"><div class="text">{f"<p class=kicker>{kicker}</p>" if kicker else ""}<h2>{title}</h2>{body}</div>{right}</section>'


def build_pdf(browser) -> Path:
    fonts = ""
    for f in (FONT, FONT_EXT):  # embedded: file:// is blocked. latin-ext has the Romanian letters
        if f.exists():
            fonts += (f"@font-face {{ font-family: 'Jakarta'; src: url(data:font/woff2;base64,{base64.b64encode(f.read_bytes()).decode()})"
                      " format('woff2'); font-weight: 200 800; }\n")
    css = fonts + f"""
    @page {{ size: 1280px 720px; margin: 0; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: 'Jakarta', 'Segoe UI', system-ui, sans-serif; color: #0f172a; }}
    .slide {{ width: 1280px; height: 720px; padding: 64px 72px; page-break-after: always; position: relative; background: #f8fafc; overflow: hidden;
             display: flex; flex-direction: column; justify-content: center; }}
    .slide::after {{ content: ''; position: absolute; right: 40px; bottom: 24px; width: 120px; height: 27px;
                    background: url({svg("skillsync-logo.svg")}) no-repeat right center / contain; }}
    .split {{ display: grid; grid-template-columns: 0.9fr 1.3fr; gap: 40px; align-items: center; justify-content: stretch; }}
    h1 {{ font-size: 72px; margin: 0; letter-spacing: -0.02em; }}
    h2 {{ font-size: 40px; margin: 0 0 22px; letter-spacing: -0.015em; line-height: 1.15; }}
    p, li {{ font-size: 22px; line-height: 1.5; color: #334155; }}
    ul {{ padding-left: 24px; margin: 0; }} li {{ margin: 8px 0; }}
    .kicker {{ color: #1d4e89; font-weight: 700; font-size: 18px; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 10px; }}
    .shot img {{ width: 100%; border-radius: 14px; box-shadow: 0 12px 40px rgba(15,23,42,.18); border: 1px solid #e2e8f0; display: block; max-height: 590px; object-fit: contain; object-position: top; background: #fff; }}
    .title {{ background: radial-gradient(circle at 80% 20%, #1d4e89, #0e2a47 60%); color: #fff; align-items: flex-start; }}
    .title::after {{ display: none; }}
    .title .logo {{ height: 120px; margin-bottom: 36px; }}
    .title .slogan {{ font-size: 54px; font-weight: 800; color: #fff; margin: 0; letter-spacing: -0.02em; line-height: 1.1; }}
    .title p {{ color: #cfe3f5; font-size: 26px; }}
    .orange {{ color: #c2410c; }}
    .grid3 {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 10px; }}
    .grid4 {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 10px; }}
    .box {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px; }}
    .box h3 {{ margin: 0 0 8px; font-size: 24px; }} .box p {{ font-size: 19px; margin: 0; }}
    .num {{ display: inline-flex; width: 36px; height: 36px; border-radius: 50%; background: #1d4e89; color: #fff; align-items: center; justify-content: center; font-weight: 700; margin-bottom: 10px; }}
    table {{ border-collapse: collapse; width: 100%; font-size: 20px; }} th, td {{ text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }}
    th {{ color: #64748b; font-weight: 600; }} .ok {{ color: #15803d; font-weight: 700; }} .bad {{ color: #dc2626; }}
    .formula {{ font-size: 26px; font-weight: 700; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 6px 0 18px; }}
    """
    slides = [
        f'<section class="slide title"><img class="logo" src="{svg("skillsync-logo-dark.svg")}" alt="SkillSync">'
        f'<p class="slogan">Match făcut. Proiect început.</p>'
        f'<p style="margin-top:28px">Micro-projects · Internships · Jobs for students and small companies.<br>'
        f'Both sides swipe right, AI explains who fits, people decide.</p>'
        f'<p style="font-size:18px;margin-top:36px;color:#9cc3e6">Prototype · October 2026</p></section>',
        slide("The problem", """<div class="grid3">
            <div class="box"><h3>Small companies</h3><p>Need a dashboard, a clean database or an automated Excel report. Not enough to hire someone for it.</p></div>
            <div class="box"><h3>Students</h3><p>Need real experience, mandatory practice and a portfolio. A CV line like "I know Power BI" proves little.</p></div>
            <div class="box"><h3>Universities</h3><p>Have little data on which skills companies actually ask for.</p></div></div>""", kicker="Why"),
        slide("The idea", """<ul><li>One platform with three tabs: <b>Projects</b>, <b>Internships</b>, <b>Jobs</b></li>
            <li>Each side says what it is looking for, for example a year-2 student who only needs the mandatory practice</li>
            <li>Not "students matched with jobs", but <b>student skills matched with real company problems</b></li>
            <li>Both sides <b>swipe right</b> to say yes. AI <b>explains</b>, people <b>decide</b></li></ul>""", "01-home.png", "What"),
        slide("How it works", """<div class="grid4">
            <div class="box"><div class="num">1</div><h3>Describe</h3><p>The company writes the problem in plain words. AI turns it into tasks and skills.</p></div>
            <div class="box"><div class="num">2</div><h3>Swipe</h3><p>Students swipe projects, companies swipe students. Two yeses make a match.</p></div>
            <div class="box"><div class="num">3</div><h3>Work</h3><p>Chat, select, deliver, with a simple progress tracker.</p></div>
            <div class="box"><div class="num">4</div><h3>Review</h3><p>Both sides rate each other. The project enters the student's portfolio.</p></div></div>""", kicker="Flow"),
        slide("Three test accounts", """<ul><li><b>Test Student</b>: finds work and builds a portfolio</li><li><b>Test SRL</b>: posts work and picks students</li>
            <li><b>Test Professor</b>: mentors, validates, reads the statistics</li></ul><p>Mock login for the prototype, with a small demo dataset (2 students, 2 companies).</p>""", "02-login.png", "Demo"),
        slide("Student dashboard", """<ul><li>"Find your next project": the swipe deck</li><li>Invitations and current work</li>
            <li>Recommendations per tab, with a fit label</li><li>Verified portfolio with ratings</li></ul>""", "03-student-dashboard.png", "Student"),
        slide("Swipe to match", """<ul><li>One card at a time, best fit first</li><li>Right = interested, left = skip, undo is one click</li>
            <li>Drag, tap the buttons or use the arrow keys</li><li>Clear mismatches are left out of the deck</li></ul>""", "04-swipe-student.png", "Student"),
        slide("It's a match!", """<ul><li>A yes stays private until the other side also says yes</li><li>Then both see the match and the chat opens</li>
            <li>Applying counts as the student's yes, inviting as the company's</li><li>The company still chooses who does the work</li></ul>""", "05-its-a-match.png", "Both sides"),
        slide("Why does it fit?", """<ul><li>Plain reasons: "Knows Excel", "Has enough free time"</li><li>Problems and things to check, when there are any</li>
            <li>The score details are one click away</li><li>Only a suggestion: students can apply anywhere</li></ul>""", "06-why-fit.png", "Student"),
        slide("CV section", """<ul><li>Upload by drag and drop: PDF, DOC, DOCX, ODT</li><li>Companies can open it from the profile</li>
            <li><span class="orange"><b>Next:</b></span> the local AI reads the CV and fills skills, courses and projects for the student to confirm</li></ul>""", "07-cv.png", "Student"),
        slide("AI reads the company's text", """<ul><li>Romanian or English, written freely</li><li>A local model (Qwen3 1.7B) extracts tasks, skills and open questions (shown: the skills it found)</li>
            <li>Rules check it: "required" vs "nice to have" comes from the company's own words</li><li>The company confirms everything before publishing</li></ul>""", "08-ai-extraction.png", "Company"),
        slide("Companies swipe too", """<ul><li>Students who fit the company's open opportunities</li><li>"Applied" shows who already said yes</li>
            <li>Skills, free time, finished projects and rating on one card</li><li>Filter by opportunity</li></ul>""", "09-swipe-company.png", "Company"),
        slide("Candidates", """<ul><li><b>Suggested</b>: every student, best fits first</li><li><b>Matches</b>, <b>Applicants</b> and <b>Invited</b></li>
            <li>"Why?" explains each suggestion</li><li>Message, invite or select a student</li></ul>""", "10-candidates.png", "Company"),
        slide("University insights", """<ul><li>Skills companies ask for most</li><li>Skill gap: demand vs. what students have</li>
            <li>University Verified projects and mentorship requests</li><li>Input for updating the curriculum</li></ul>""", "11-insights.png", "Professor"),
        slide("How the matching works", """<div class="formula">score = 50% skills + 25% experience + 15% interests + 10% text similarity</div>
            <div class="grid4">
            <div class="box"><div class="num">1</div><h3>Filter</h3><p>Type of work, hours, period, remote or office, required skills. A clear mismatch means "Not a fit".</p></div>
            <div class="box"><div class="num">2</div><h3>Score</h3><p>Skills you know and skills you want to learn count differently. Verified projects count more.</p></div>
            <div class="box"><div class="num">3</div><h3>Swipe</h3><p>The ranking becomes a deck. A match needs a yes from both sides.</p></div>
            <div class="box"><div class="num">4</div><h3>Learn later</h3><p>Every swipe and action is logged, so a trained model can replace the rules once there is real data.</p></div></div>""", kicker="Algorithm"),
        slide("AI that runs on a normal PC", """<p>Measured on a GTX 1050 Ti (4 GB), i5-9400F, 16 GB RAM:</p>
            <table><tr><th>Model</th><th>Where</th><th>Speed</th><th>One extraction</th></tr>
            <tr><td>qwen3:4b</td><td>GPU, did not fit</td><td class="bad">0.4 tokens/s</td><td class="bad">timeout</td></tr>
            <tr><td>qwen3:4b</td><td>CPU</td><td class="bad">1.8 tokens/s</td><td class="bad">minutes</td></tr>
            <tr><td><b>qwen3:1.7b</b></td><td>GPU, fully</td><td class="ok">~34 tokens/s</td><td class="ok">5-15 s</td></tr></table>
            <p>Embeddings: multilingual MiniLM (Romanian + English). Everything has a fallback, so the app works even without the AI.</p>""", kicker="AI"),
        slide("Technology", """<div class="grid3">
            <div class="box"><h3>App</h3><p>React, TypeScript, Tailwind · FastAPI (Python) · one container</p></div>
            <div class="box"><h3>Data</h3><p>MySQL · optional Neo4j skill graph</p></div>
            <div class="box"><h3>AI</h3><p>Ollama + Qwen3 · sentence-transformers</p></div></div>
            <p style="margin-top:28px">Only open-source components and no paid services. <code>docker compose up</code> starts everything on one PC
            (3 containers). 41 automated tests and an offline evaluation of the matching.</p>""", kicker="Stack"),
        slide("Next steps", """<ul><li>AI fills the student profile from the CV</li><li>Real authentication and secure accounts</li>
            <li>Pilot with a few SMEs and one faculty</li><li>Learn better weights from real swipes, applications and ratings</li>
            <li>Payments and contracts</li></ul>""", kicker="Roadmap"),
    ]
    html = f"<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>{''.join(slides)}</body></html>"
    page = browser.new_page()
    page.set_content(html, wait_until="load")
    page.evaluate("document.fonts.ready")
    for old in OUT.glob("GoBiz-*"):
        old.unlink()
    target = OUT / "SkillSync-presentation.pdf"
    page.pdf(path=str(target), width="1280px", height="720px", print_background=True)
    page.close()
    return target


# ---------------------------------------------------------------- 3. 30-second demo video (no captions)
# A fake mouse pointer, so viewers can follow the clicks. It lives in the top layer (popover) and is moved back to the
# top whenever a modal dialog opens, so it stays visible above dialogs too.
CURSOR_JS = """
(() => {
  const install = () => {
    if (document.getElementById('__cursor')) return;
    const c = document.createElement('div');
    c.id = '__cursor';
    c.popover = 'manual';
    c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 2.5l14 9-6.3 1.3 3.6 6.8-2.7 1.4-3.6-6.8L5 18.5z" fill="#0e2a47" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {position: 'fixed', inset: 'auto', left: '0', top: '0', margin: '0', padding: '0', border: '0',
      background: 'transparent', overflow: 'visible', pointerEvents: 'none', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))'});
    document.body.appendChild(c);
    const place = (x, y) => { c.style.transform = `translate(${x - 4}px, ${y - 2}px)`; };
    const saved = JSON.parse(sessionStorage.getItem('__cur') || '[800, 450]');
    place(saved[0], saved[1]);
    c.showPopover();
    addEventListener('mousemove', (e) => { place(e.clientX, e.clientY); sessionStorage.setItem('__cur', JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('div');
      r.popover = 'manual';
      Object.assign(r.style, {position: 'fixed', inset: 'auto', left: (e.clientX - 20) + 'px', top: (e.clientY - 20) + 'px', margin: '0', padding: '0',
        width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #4a9bd4', background: 'rgba(74,155,212,.15)',
        pointerEvents: 'none', transition: 'transform .45s ease-out, opacity .45s ease-out'});
      document.body.appendChild(r); r.showPopover(); c.hidePopover(); c.showPopover();
      requestAnimationFrame(() => requestAnimationFrame(() => { r.style.transform = 'scale(1.9)'; r.style.opacity = '0'; }));
      setTimeout(() => r.remove(), 600);
    }, true);
    new MutationObserver(() => { if (document.querySelector('dialog[open]')) { c.hidePopover(); c.showPopover(); } })
      .observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
})();
"""


class Recorder:
    """Collects Chromium screencast frames; pause() cuts dead time (page loads, waiting for the LLM) out of the video."""

    def __init__(self, cdp):
        self.cdp = cdp
        self.frames: list[tuple[float, bytes]] = []
        self.paused = False
        self.offset = 0.0
        self.pause_at = 0.0
        self.latest: bytes | None = None
        self._acks: set[asyncio.Future] = set()
        cdp.on("Page.screencastFrame", self._on_frame)

    def _on_frame(self, params: dict) -> None:
        # keep a reference to the ack task: an unreferenced task can be garbage-collected before it runs, and
        # without acks Chromium stops sending frames (and later stops handling input)
        task = asyncio.ensure_future(self.cdp.send("Page.screencastFrameAck", {"sessionId": params["sessionId"]}))
        self._acks.add(task)
        task.add_done_callback(self._acks.discard)
        data = base64.b64decode(params["data"])
        self.latest = data
        if not self.paused:
            self.frames.append((time.monotonic() - self.offset, data))

    async def start(self) -> None:
        await self.cdp.send("Page.startScreencast", {"format": "jpeg", "quality": 92, "maxWidth": 1920, "maxHeight": 1080})

    def pause(self) -> None:
        self.paused, self.pause_at = True, time.monotonic()

    def resume(self) -> None:
        self.offset += time.monotonic() - self.pause_at
        self.paused = False
        if self.latest is not None:  # the page may be static now: show what it looks like after the cut
            self.frames.append((time.monotonic() - self.offset, self.latest))

    async def stop(self) -> None:
        await self.cdp.send("Page.stopScreencast")

    def encode(self, target: Path, seconds: float) -> float:
        tmp = OUT / "_video_tmp"
        shutil.rmtree(tmp, ignore_errors=True)
        tmp.mkdir()
        lines = []
        t_end = time.monotonic() - self.offset
        for i, (t, data) in enumerate(self.frames):
            (tmp / f"{i:05d}.jpg").write_bytes(data)
            nxt = self.frames[i + 1][0] if i + 1 < len(self.frames) else t_end
            lines += [f"file '{i:05d}.jpg'", f"duration {max(nxt - t, 0.001):.4f}"]
        lines.append(f"file '{len(self.frames) - 1:05d}.jpg'")  # concat demuxer: repeat the last file
        (tmp / "list.txt").write_text("\n".join(lines), encoding="utf-8")
        raw = t_end - self.frames[0][0]
        speed = raw / seconds
        subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(tmp / "list.txt"),
            "-vf", f"setpts=PTS/{speed:.5f},scale=1920:1080:flags=lanczos:in_range=full:out_range=limited,format=yuv420p,fps=30", "-t", str(seconds),
            # modest memory use: the PC also runs Docker, the LLM and the browser
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-threads", "2", "-x264-params", "rc-lookahead=10",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(target),
        ], check=True)
        shutil.rmtree(tmp, ignore_errors=True)
        return raw


async def record_video(user_ids: dict[str, int]) -> Path:
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 1600, "height": 900}, device_scale_factor=1.2)
        await ctx.add_init_script(ENGLISH_UI)
        await ctx.add_init_script(CURSOR_JS)
        page = await ctx.new_page()
        rec = Recorder(await ctx.new_cdp_session(page))
        mouse = {"x": 800.0, "y": 450.0}

        async def move(x: float, y: float, ms: int = 550) -> None:
            """Glide the pointer in real time (each step's round trip is part of the duration)."""
            x0, y0 = mouse["x"], mouse["y"]
            t0 = time.monotonic()
            while True:
                k = min(1.0, (time.monotonic() - t0) * 1000 / ms)
                e = k * k * (3 - 2 * k)  # ease in-out
                await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e)
                if k >= 1:
                    break
                await page.wait_for_timeout(8)
            mouse.update(x=x, y=y)

        async def click(locator, ms: int = 550, after: int = 250) -> None:
            await locator.scroll_into_view_if_needed()
            box = await locator.bounding_box()
            await move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, ms)
            await page.mouse.down()
            await page.wait_for_timeout(90)
            await page.mouse.up()
            await page.wait_for_timeout(after)

        async def drag_card(dx: float, ms: int = 700) -> None:
            card = page.locator("div.cursor-grab").first
            box = await card.bounding_box()
            x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.42
            await move(x, y, 350)
            await page.mouse.down()
            await move(x + dx, y + 18, ms)
            await page.wait_for_timeout(120)
            await page.mouse.up()

        async def cut_to(url: str, ready: str, user: int | None = None, theme: str | None = None) -> None:
            """Jump to another page or account without showing the loading."""
            rec.pause()
            if user is not None or theme is not None:
                await page.evaluate("([u, t]) => { if (u) localStorage.setItem('skillsync-user', String(u)); if (t) localStorage.setItem('skillsync-theme', t); }",
                                    [user, theme])
            await page.goto(url)
            await page.wait_for_selector(ready, timeout=180_000)
            await page.wait_for_timeout(500)
            rec.resume()

        await page.goto(BASE)
        await page.wait_for_selector("text=How it works")
        await page.wait_for_timeout(800)
        await rec.start()

        # 1. home: logo + slogan -> start matching -> login as the student
        await page.wait_for_timeout(1500)
        await click(page.get_by_role("link", name="Start matching"))
        await page.get_by_role("button", name=re.compile("Log in as Test Student")).wait_for()
        await page.wait_for_timeout(200)
        await click(page.get_by_role("button", name=re.compile("Log in as Test Student")), after=0)
        rec.pause()
        await page.wait_for_selector("text=Recommended for you")
        await page.wait_for_timeout(700)
        rec.resume()

        # 2. student dashboard -> swipe deck -> right swipe on a company that already said yes -> match -> chat
        await page.wait_for_timeout(1000)
        await click(page.get_by_text("Start swiping"), after=0)
        rec.pause()
        await page.get_by_role("button", name=re.compile("I'm interested")).wait_for()
        await page.wait_for_timeout(600)
        rec.resume()
        await page.wait_for_timeout(300)
        await drag_card(300)
        await page.wait_for_selector("#match-title")
        await page.wait_for_timeout(1800)
        await click(page.get_by_role("button", name="Send message"), ms=550, after=0)
        await page.wait_for_selector("text=When can we talk?")
        await page.wait_for_timeout(1400)

        # 3. back to the deck: pass on one card, like another
        await click(page.get_by_role("link", name="Match", exact=True), after=0)
        await page.get_by_role("button", name=re.compile("I'm interested")).wait_for()
        await page.wait_for_timeout(700)
        await click(page.get_by_role("button", name=re.compile("^Pass")), ms=450, after=700)
        await click(page.get_by_role("button", name=re.compile("I'm interested")), ms=400, after=800)

        # 4. company: describe a problem, the local LLM extracts tasks and skills
        await cut_to(f"{BASE}/company/new", "text=Fill with an example", user=user_ids["testsrl"])
        await click(page.get_by_role("button", name="Fill with an example"), after=400)
        await click(page.get_by_role("button", name="Analyze with AI"), after=0)
        rec.pause()
        await page.wait_for_selector("text=Extracted by", timeout=180_000)
        await page.wait_for_timeout(400)
        rec.resume()
        await page.wait_for_timeout(1100)
        await page.mouse.wheel(0, 380)
        await page.wait_for_timeout(1400)

        # 5. company swipes a student who applied -> match
        await cut_to(f"{BASE}/match", "text=Students for")
        await page.wait_for_timeout(400)
        await drag_card(300)
        await page.wait_for_selector("#match-title")
        await page.wait_for_timeout(1800)

        # 6. professor: what companies ask for vs. what students know, then dark mode
        await cut_to(f"{BASE}/university", "text=University insights", user=user_ids["testprofessor"])
        await page.wait_for_timeout(1500)
        await page.mouse.wheel(0, 520)
        await page.wait_for_timeout(1200)
        await click(page.get_by_role("button", name="Switch to dark theme"), ms=500, after=1100)

        # 7. end on the logo and the slogan
        await cut_to(BASE, "text=How it works", user=user_ids["testprofessor"], theme="dark")
        await move(1500, 860, 500)
        await page.wait_for_timeout(2000)

        await rec.stop()
        await browser.close()

    target = OUT / "SkillSync-demo.mp4"
    raw = rec.encode(target, VIDEO_SECONDS)
    print(f"Recorded {raw:.1f} s, encoded to {VIDEO_SECONDS} s ({raw / VIDEO_SECONDS:.2f}x).")
    return target


def main() -> None:
    try:
        urllib.request.urlopen(f"{BASE}/api/health", timeout=5)
    except Exception:  # noqa: BLE001
        sys.exit(f"The app is not running on {BASE}. Start it with: docker compose up")
    only = set(sys.argv[1:])  # optional: "pdf" or "video"
    reset_demo()
    if not only or "pdf" in only:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            take_screenshots(browser)
            print("PDF:", build_pdf(browser))
            browser.close()
        reset_demo()
    if not only or "video" in only:
        users = {u: api("/auth/login", {"username": u, "password": "test123"})["id"] for u in ("testsrl", "testprofessor")}
        print("Video:", asyncio.run(record_video(users)))
        reset_demo()


if __name__ == "__main__":
    main()
