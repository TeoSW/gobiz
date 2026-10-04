"""Generate the GoBiz presentation: screenshots, a narrated-by-captions demo video and a PDF deck.

Requires the app running on http://localhost:8080 (docker compose up) and Playwright (Apache-2.0):
    pip install playwright pypdf
    python -m playwright install chromium
    python docs/presentation/make_presentation.py

Outputs (next to this file): screens/*.png, GoBiz-demo.webm, GoBiz-presentation.pdf.
The demo data is reset before and after, so the run leaves the app as it was.
"""

import base64
import re
import shutil
import sys
import urllib.request
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

BASE = "http://localhost:8080"
OUT = Path(__file__).resolve().parent
SHOTS = OUT / "screens"
ROOT = OUT.parents[1]
FONT = ROOT / "frontend/node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2"


def reset_demo() -> None:
    req = urllib.request.Request(f"{BASE}/api/system/reset-demo", method="POST")
    urllib.request.urlopen(req, timeout=60).read()


# ---------------------------------------------------------------- helpers used while recording
def caption(page: Page, text: str, hold_ms: int = 0) -> None:
    page.evaluate(
        """(text) => {
            let el = document.getElementById('__cap');
            if (!el) {
                el = document.createElement('div'); el.id = '__cap';
                Object.assign(el.style, {position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
                    background: 'rgba(15,23,42,.9)', color: '#fff', padding: '12px 24px', borderRadius: '14px',
                    font: '600 21px "Plus Jakarta Sans Variable", system-ui, sans-serif', zIndex: 99999,
                    maxWidth: '88%', textAlign: 'center', boxShadow: '0 10px 30px rgba(0,0,0,.3)', pointerEvents: 'none'});
                document.body.appendChild(el);
            }
            el.textContent = text;
        }""",
        text,
    )
    if hold_ms:
        page.wait_for_timeout(hold_ms)


def click(page: Page, locator, pause_ms: int = 700) -> None:
    """Highlight the element briefly so viewers see what is clicked."""
    locator.scroll_into_view_if_needed()
    locator.evaluate("e => { e.style.outline = '3px solid #EA580C'; e.style.outlineOffset = '3px'; }")
    page.wait_for_timeout(pause_ms)
    locator.click()
    page.wait_for_timeout(250)
    page.evaluate("document.querySelectorAll('[style*=outline]').forEach(e => { e.style.outline = ''; })")


def scroll(page: Page, total: int, step: int = 120, delay_ms: int = 120) -> None:
    page.mouse.move(640, 360)
    for _ in range(max(1, total // step)):
        page.mouse.wheel(0, step if total > 0 else -step)
        page.wait_for_timeout(delay_ms)


def login(page: Page, name: str) -> None:
    page.goto(f"{BASE}/login")
    page.get_by_role("button", name=re.compile(f"Log in as {name}")).wait_for()


def logout(page: Page) -> None:
    page.get_by_role("button", name="Log out").click()
    page.wait_for_url("**/login")


# ---------------------------------------------------------------- 1. screenshots for the PDF
def take_screenshots(browser) -> None:
    SHOTS.mkdir(parents=True, exist_ok=True)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    # the sticky header would cover the top of element screenshots
    ctx.add_init_script("document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style');"
                        " s.textContent = 'header { position: relative !important; }'; document.head.appendChild(s); })")
    page = ctx.new_page()

    page.goto(BASE)
    page.wait_for_selector("text=How it works")
    page.screenshot(path=SHOTS / "01-home.png")

    login(page, "Test Student")
    page.screenshot(path=SHOTS / "02-login.png")
    page.get_by_role("button", name=re.compile("Log in as Test Student")).click()
    page.wait_for_selector("text=Recommended for you")
    page.wait_for_timeout(1500)
    page.screenshot(path=SHOTS / "03-student-dashboard.png")

    page.goto(f"{BASE}/explore")
    page.wait_for_selector("text=Sales dashboard in Power BI")
    page.wait_for_timeout(800)
    page.screenshot(path=SHOTS / "04-explore.png")

    page.get_by_role("link", name=re.compile("Sales dashboard in Power BI")).click()
    fit = page.locator("div.card", has=page.get_by_role("heading", name="How well you fit"))
    fit.wait_for()
    page.wait_for_timeout(500)
    fit.screenshot(path=SHOTS / "05-match.png")  # collapsed: the plain-language part only

    page.goto(f"{BASE}/student/profile")
    page.locator("section", has=page.get_by_role("heading", name="Your CV")).wait_for()
    page.screenshot(path=SHOTS / "06-cv.png")
    logout(page)

    login(page, "Test SRL")
    page.get_by_role("button", name=re.compile("Log in as Test SRL")).click()
    page.wait_for_url("**/company")
    page.goto(f"{BASE}/company/new")
    page.get_by_role("button", name="Fill with an example").click()
    page.get_by_role("button", name="Analyze with AI").click()
    page.wait_for_selector("text=Extracted by", timeout=180_000)
    page.wait_for_timeout(500)
    skills = page.locator("div.card", has=page.get_by_role("heading", name="Skills", exact=True))
    skills.screenshot(path=SHOTS / "07-ai-extraction.png")

    page.goto(f"{BASE}/company")
    page.get_by_role("link", name=re.compile("New design for our online shop")).click()
    cands = page.locator("section", has=page.get_by_role("heading", name="Candidates"))
    cands.wait_for()
    page.wait_for_timeout(1500)
    cands.screenshot(path=SHOTS / "08-candidates.png")
    logout(page)

    login(page, "Test Professor")
    page.get_by_role("button", name=re.compile("Log in as Test Professor")).click()
    page.wait_for_selector("text=University insights")
    page.wait_for_timeout(2500)  # chart animation
    page.screenshot(path=SHOTS / "09-insights.png")
    ctx.close()


# ---------------------------------------------------------------- 2. demo video
def record_video(browser) -> Path:
    tmp = OUT / "_video_tmp"
    ctx = browser.new_context(viewport={"width": 1280, "height": 720}, record_video_dir=str(tmp),
                              record_video_size={"width": 1280, "height": 720})
    page = ctx.new_page()

    page.goto(BASE)
    page.wait_for_selector("text=How it works")
    caption(page, "GoBiz connects students with small companies that need real projects done", 3500)
    scroll(page, 700)
    caption(page, "Companies post projects, internships and jobs. AI suggests who fits, people decide.", 3000)
    scroll(page, -700, delay_ms=60)

    login(page, "Test Student")
    caption(page, "Mock login with three test accounts: a student, a company and a professor", 3000)
    click(page, page.get_by_role("button", name=re.compile("Log in as Test Student")))
    page.wait_for_selector("text=Recommended for you")
    caption(page, "The student dashboard: rating, invitations, current work and the CV section", 3500)
    scroll(page, 900)
    caption(page, "Recommendations come with a simple fit label", 3000)
    scroll(page, 600)
    caption(page, "Finished projects form a verified portfolio, rated by the company", 3000)

    page.goto(f"{BASE}/explore")
    page.wait_for_selector("text=Sales dashboard in Power BI")
    caption(page, "Opportunities in three tabs: projects, internships and jobs", 3000)
    click(page, page.get_by_role("link", name=re.compile("Sales dashboard in Power BI")))
    page.get_by_role("heading", name="How well you fit").wait_for()
    caption(page, "Why does it fit? Plain reasons instead of a black-box score", 3000)
    page.get_by_role("heading", name="How well you fit").scroll_into_view_if_needed()
    page.wait_for_timeout(1500)
    click(page, page.get_by_text("How is this score calculated?"))
    caption(page, "Details stay one click away: skills, experience, interests and text similarity", 3500)

    page.goto(f"{BASE}/student/profile")
    page.locator("section", has=page.get_by_role("heading", name="Your CV")).wait_for()
    caption(page, "Students upload their CV. Next step: AI fills the profile from it", 3500)
    scroll(page, 700)
    caption(page, "Skills have levels, plus a separate 'want to learn' choice", 3000)
    logout(page)

    page.get_by_role("button", name=re.compile("Log in as Test SRL")).wait_for()
    click(page, page.get_by_role("button", name=re.compile("Log in as Test SRL")))
    page.wait_for_url("**/company")
    caption(page, "The company sees its opportunities and applicants", 3000)
    click(page, page.get_by_role("link", name="Post opportunity"))
    page.get_by_role("button", name="Fill with an example").wait_for()
    caption(page, "The company writes what it needs, in Romanian or English", 2000)
    click(page, page.get_by_role("button", name="Fill with an example"))
    page.wait_for_timeout(1500)
    click(page, page.get_by_role("button", name="Analyze with AI"))
    caption(page, "A local AI model (Qwen3, on the GPU) reads the text...")
    page.wait_for_selector("text=Extracted by", timeout=180_000)
    caption(page, "...and turns it into tasks and skills. The company checks every one.", 3500)
    scroll(page, 700)
    caption(page, "'Required' or 'nice to have' comes from the company's own words", 3000)
    click(page, page.get_by_role("button", name="Continue"))
    page.get_by_role("button", name="Publish").wait_for()
    caption(page, "Budget, dates and academic use (course credit, practice, thesis)", 3000)
    click(page, page.get_by_role("button", name="Publish"))
    page.wait_for_selector("text=Recommended students")
    caption(page, "Published. Matching students are suggested right away.", 4000)

    page.goto(f"{BASE}/company")
    click(page, page.get_by_role("link", name=re.compile("New design for our online shop")))
    page.get_by_role("heading", name="Candidates").wait_for()
    page.get_by_role("heading", name="Candidates").scroll_into_view_if_needed()
    caption(page, "Candidates: suggested by AI, applicants and invited students", 3500)
    click(page, page.get_by_role("tab", name=re.compile("Applicants")))
    caption(page, "The company can message, invite or select any student", 3500)
    logout(page)

    click(page, page.get_by_role("button", name=re.compile("Log in as Test Professor")))
    page.wait_for_selector("text=University insights")
    caption(page, "The professor sees which skills companies ask for", 3500)
    scroll(page, 500)
    caption(page, "...compared with the skills students already have", 3500)
    scroll(page, 900)
    caption(page, "Professors validate projects and mentor students", 3500)

    page.goto(BASE)
    page.wait_for_selector("text=How it works")
    caption(page, "GoBiz: open source, runs on one PC with Docker. Thank you!", 4000)

    video = page.video
    ctx.close()
    target = OUT / "GoBiz-demo.webm"
    shutil.move(video.path(), target)
    shutil.rmtree(tmp, ignore_errors=True)
    return target


# ---------------------------------------------------------------- 3. PDF deck
def img(name: str) -> str:
    return "data:image/png;base64," + base64.b64encode((SHOTS / name).read_bytes()).decode()


def slide(title: str, body: str = "", shot: str | None = None, kicker: str = "") -> str:
    right = f'<div class="shot"><img src="{img(shot)}"></div>' if shot else ""
    cls = "slide split" if shot else "slide"
    return f'<section class="{cls}"><div class="text">{f"<p class=kicker>{kicker}</p>" if kicker else ""}<h2>{title}</h2>{body}</div>{right}</section>'


def build_pdf(browser) -> Path:
    font_data = base64.b64encode(FONT.read_bytes()).decode() if FONT.exists() else ""  # embedded: file:// is blocked
    font_css = f"@font-face {{ font-family: 'Jakarta'; src: url(data:font/woff2;base64,{font_data}) format('woff2'); font-weight: 200 800; }}" if font_data else ""
    css = font_css + """
    @page { size: 1280px 720px; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Jakarta', 'Segoe UI', system-ui, sans-serif; color: #0f172a; }
    .slide { width: 1280px; height: 720px; padding: 64px 72px; page-break-after: always; position: relative; background: #f8fafc; overflow: hidden;
             display: flex; flex-direction: column; justify-content: center; }
    .slide::after { content: 'GoBiz'; position: absolute; right: 40px; bottom: 26px; font-weight: 800; color: #2563eb; font-size: 18px; }
    .split { display: grid; grid-template-columns: 0.9fr 1.3fr; gap: 40px; align-items: center; justify-content: stretch; }
    h1 { font-size: 72px; margin: 0; letter-spacing: -0.02em; }
    h2 { font-size: 40px; margin: 0 0 22px; letter-spacing: -0.015em; line-height: 1.15; }
    p, li { font-size: 22px; line-height: 1.5; color: #334155; }
    ul { padding-left: 24px; margin: 0; } li { margin: 8px 0; }
    .kicker { color: #2563eb; font-weight: 700; font-size: 18px; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 10px; }
    .shot img { width: 100%; border-radius: 14px; box-shadow: 0 12px 40px rgba(15,23,42,.18); border: 1px solid #e2e8f0; display: block; max-height: 590px; object-fit: contain; object-position: top; background: #fff; }
    .title { background: linear-gradient(135deg, #1d4ed8, #2563eb 55%, #3b82f6); color: #fff; display: flex; flex-direction: column; justify-content: center; }
    .title p { color: #dbeafe; font-size: 28px; } .title::after { color: #fff; }
    .orange { color: #ea580c; }
    .grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 10px; }
    .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 10px; }
    .box { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 22px; }
    .box h3 { margin: 0 0 8px; font-size: 24px; } .box p { font-size: 19px; margin: 0; }
    .num { display: inline-flex; width: 36px; height: 36px; border-radius: 50%; background: #2563eb; color: #fff; align-items: center; justify-content: center; font-weight: 700; margin-bottom: 10px; }
    table { border-collapse: collapse; width: 100%; font-size: 20px; } th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
    th { color: #64748b; font-weight: 600; } .ok { color: #15803d; font-weight: 700; } .bad { color: #dc2626; }
    .formula { font-size: 26px; font-weight: 700; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 22px; margin: 6px 0 18px; }
    """
    slides = [
        f'<section class="slide title"><p class="kicker" style="color:#bfdbfe">Prototype · October 2026</p><h1>GoBiz</h1>'
        f'<p>Real projects for students.<br>Real help for small companies.</p>'
        f'<p style="font-size:22px;margin-top:40px">Micro-projects · Internships · Jobs, matched with AI that suggests and people who decide.</p></section>',
        slide("The problem", """<div class="grid3">
            <div class="box"><h3>Small companies</h3><p>Need a dashboard, a clean database or an automated Excel report. Not enough to hire someone for it.</p></div>
            <div class="box"><h3>Students</h3><p>Need real experience, mandatory practice and a portfolio. A CV line like "I know Power BI" proves little.</p></div>
            <div class="box"><h3>Universities</h3><p>Have little data on which skills companies actually ask for.</p></div></div>""", kicker="Why"),
        slide("The idea", """<ul><li>One platform with three tabs: <b>Projects</b>, <b>Internships</b>, <b>Jobs</b></li>
            <li>Each side says what it is looking for, for example a year-2 student who only needs the mandatory practice</li>
            <li>Not "students matched with jobs", but <b>student skills matched with real company problems</b></li>
            <li>AI <b>suggests</b>; students and companies <b>decide</b></li></ul>""", "01-home.png", "What"),
        slide("How it works", """<div class="grid4">
            <div class="box"><div class="num">1</div><h3>Describe</h3><p>The company writes the problem in plain words.</p></div>
            <div class="box"><div class="num">2</div><h3>Match</h3><p>AI turns it into tasks and skills and suggests students.</p></div>
            <div class="box"><div class="num">3</div><h3>Work</h3><p>Apply or invite, select, messages, progress tracker.</p></div>
            <div class="box"><div class="num">4</div><h3>Review</h3><p>Both sides rate each other. The project enters the student's portfolio.</p></div></div>""", kicker="Flow"),
        slide("Three test accounts", """<ul><li><b>Test Student</b>: finds work and builds a portfolio</li><li><b>Test SRL</b>: posts work and picks students</li>
            <li><b>Test Professor</b>: mentors, validates, reads the statistics</li></ul><p>Mock login for the prototype, with a small demo dataset (2 students, 2 companies).</p>""", "02-login.png", "Demo"),
        slide("Student dashboard", """<ul><li>Invitations from companies</li><li>Current work</li><li>Recommendations per tab, with a fit label</li>
            <li>Verified portfolio with ratings</li></ul>""", "03-student-dashboard.png", "Student"),
        slide("Why does it fit?", """<ul><li>Plain reasons: "Knows Power BI", "Has enough free time"</li><li>Problems and things to check, when there are any</li>
            <li>The score details are one click away</li><li>Only a suggestion: students can apply anywhere</li></ul>""", "05-match.png", "Student"),
        slide("CV section", """<ul><li>Upload by drag and drop: PDF, DOC, DOCX, ODT</li><li>Companies can open it from the profile</li>
            <li><span class="orange"><b>Next:</b></span> the local AI reads the CV and fills skills, courses and projects for the student to confirm</li></ul>""", "06-cv.png", "Student"),
        slide("AI reads the company's text", """<ul><li>Romanian or English, written freely</li><li>A local model (Qwen3 1.7B) extracts tasks, skills and open questions (shown: the skills it found)</li>
            <li>Rules check it: "required" vs "nice to have" comes from the company's own words</li><li>The company confirms everything before publishing</li></ul>""", "07-ai-extraction.png", "Company"),
        slide("Candidates", """<ul><li><b>Suggested</b>: every student, best fits first</li><li><b>Applicants</b> and <b>Invited</b></li>
            <li>"Why?" explains each suggestion</li><li>Message, invite or select any student</li></ul>""", "08-candidates.png", "Company"),
        slide("University insights", """<ul><li>Skills companies ask for most</li><li>Skill gap: demand vs. what students have</li>
            <li>University Verified projects and mentorship requests</li><li>Input for updating the curriculum</li></ul>""", "09-insights.png", "Professor"),
        slide("How the matching works", """<div class="formula">score = 50% skills + 25% experience + 15% interests + 10% text similarity</div>
            <div class="grid4">
            <div class="box"><div class="num">1</div><h3>Filter</h3><p>Type of work, hours, period, remote or office, required skills. A clear mismatch means "Not a fit".</p></div>
            <div class="box"><div class="num">2</div><h3>Score</h3><p>Skills you know and skills you want to learn count differently. Verified projects count more.</p></div>
            <div class="box"><div class="num">3</div><h3>Explain</h3><p>Every result comes with plain reasons and things to check.</p></div>
            <div class="box"><div class="num">4</div><h3>Learn later</h3><p>Every action is logged, so a trained model can replace the rules once there is real data.</p></div></div>""", kicker="Algorithm"),
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
            (3 containers). 37 automated tests and an offline evaluation of the matching.</p>""", kicker="Stack"),
        slide("Next steps", """<ul><li>AI fills the student profile from the CV</li><li>Real authentication and secure accounts</li>
            <li>Pilot with a few SMEs and one faculty</li><li>Learn better weights from real applications and ratings</li>
            <li>Payments and contracts</li></ul>""", kicker="Roadmap"),
    ]
    html = f"<!doctype html><html><head><meta charset='utf-8'><style>{css}</style></head><body>{''.join(slides)}</body></html>"
    page = browser.new_page()
    page.set_content(html, wait_until="load")
    page.evaluate("document.fonts.ready")
    target = OUT / "GoBiz-presentation.pdf"
    page.pdf(path=str(target), width="1280px", height="720px", print_background=True)
    page.close()
    return target


def main() -> None:
    try:
        urllib.request.urlopen(f"{BASE}/api/health", timeout=5)
    except Exception:  # noqa: BLE001
        sys.exit(f"The app is not running on {BASE}. Start it with: docker compose up")
    reset_demo()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        take_screenshots(browser)
        reset_demo()
        video = record_video(browser)
        pdf = build_pdf(browser)
        browser.close()
    reset_demo()
    print("Screenshots:", SHOTS)
    print("Video:", video)
    print("PDF:", pdf)


if __name__ == "__main__":
    main()
