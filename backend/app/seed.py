"""Demo data: 2 students, 2 companies and 1 professor.

Three accounts can log in (Test Student, Test SRL, Test Professor); the other two users exist as data so that
companies see more than one candidate and students see more than one company. The larger dataset used for the
matching evaluation lives in scripts/eval_dataset.py.
"""

from datetime import date, timedelta

from .db import Base, SessionLocal, engine
from .models import (
    AppMeta, Application, CompanyProfile, MentorshipRequest, Message, Opportunity, OpportunitySkill, PastProject,
    Review, Skill, StudentProfile, StudentSkill, Swipe, User,
)
from .security import hash_password
from .skills_catalog import SKILLS

# bump when the demo data or the schema changes: an older database is then re-created on startup
SEED_VERSION = "3-skillsync-swipe"

R = dict  # requirement shorthand: R(s=skill, l=min_level, m=mandatory, learn=learnable)


def d(days: int) -> date:
    return date.today() + timedelta(days=days)


# Demo logins (mockup, not real security). Also listed on the login page and in the README.
DEMO_ACCOUNTS = {
    "test_student": ("teststudent", "test123"),
    "test_srl": ("testsrl", "test123"),
    "prof": ("testprofessor", "test123"),
}

STUDENTS = [
    dict(key="test_student", name="Test Student", headline="Data analysis student - Excel, Power BI, SQL",
         university="Bucharest University of Economic Studies", faculty="Cybernetics, Statistics and Economic Informatics",
         study_program="Economic Informatics", year=3, city="Bucharest", hours=20, mode="any",
         types=["project", "internship"], goals=["paid_project", "course_credit", "mandatory_practice"],
         domains=["retail", "finance", "logistics"], courses=["Databases", "Business Intelligence", "Statistics"],
         bio="I like turning messy Excel files into clear reports. I have built Power BI dashboards for university "
             "projects and I am learning Python.",
         skills={"excel": 3, "power_bi": 2, "sql": 2, "data_visualization": 2, "dashboards": 2, "statistics": 2, "python": 1},
         wants={"machine_learning": 0},
         projects=[("Sales report for a course project", "Power BI report on a public retail dataset.",
                    ["power_bi", "excel"], "retail")]),
    dict(key="maria", name="Maria Ionescu", headline="Python and web developer",
         university="Politehnica University of Bucharest", faculty="Automatic Control and Computers",
         study_program="Computer Science", year=4, city="Bucharest", hours=20, mode="remote",
         types=["project", "job"], goals=["paid_project", "part_time_job"], domains=["e-commerce", "logistics", "it-services"],
         courses=["Web Programming", "Databases", "Machine Learning"],
         bio="I build web apps in React and small tools in Python: scrapers, scripts that automate reports and REST APIs.",
         skills={"python": 3, "web_development": 3, "git": 3, "react": 2, "javascript": 2, "sql": 2, "web_scraping": 2,
                 "process_automation": 2, "backend_api": 2},
         projects=[("Price tracker", "Scraper that checks prices on 5 online shops.", ["web_scraping", "python"], "e-commerce")]),
]

COMPANIES = [
    dict(key="test_srl", name="Test SRL", headline="Home and garden shop with 3 stores and an online shop (demo company)",
         industry="retail", size="10-49", city="Bucharest", website="",
         description="Demo company. Sells home and garden products in 3 stores and online."),
    dict(key="demo_logistics", name="Demo Logistics SRL", headline="Transport and warehousing (demo company)",
         industry="logistics", size="10-49", city="Cluj-Napoca", website="",
         description="Demo company. 40 trucks and one warehouse."),
]

UNIVERSITY = [dict(key="prof", name="Test Professor", headline="University mentor and project validator (demo)")]

OPPORTUNITIES = [
    # ---------------------------------------------------------------- Test SRL
    dict(key="pbi", company="test_srl", type="project", title="Sales dashboard in Power BI",
         description="We have about 30,000 sales transactions in Excel files. We want a Power BI dashboard that shows "
                     "sales by product, month and store. Power BI is required; SQL is a plus. The report should be easy "
                     "for store managers to read.",
         tasks=["Clean and combine the Excel files", "Build the data model", "Create the dashboard pages",
                "Write a short guide for the monthly update"],
         outcome="Power BI file and a 1-page guide", domain="retail", difficulty=2, hours=10, weeks=3, start=7,
         mode="remote", city="Bucharest", comp=("fixed", 1500), academic=["course_credit"], mentoring=False,
         reqs=[R(s="power_bi", l=2, m=True), R(s="excel", l=2, m=True), R(s="sql", l=1), R(s="data_visualization", l=1)],
         verified=True),
    dict(key="site", company="test_srl", type="project", title="New design for our online shop",
         description="Our online shop looks old. We want a new, simple and mobile-friendly version built in React, "
                     "from a design that is already made in Figma.",
         tasks=["Build the pages from the Figma design", "Make it work well on phones", "Connect the product list to our API"],
         outcome="Working website and its code", domain="e-commerce", difficulty=2, hours=15, weeks=4, start=10,
         mode="hybrid", city="Bucharest", comp=("fixed", 2500), academic=[], mentoring=False,
         reqs=[R(s="react", l=2, m=True), R(s="web_development", l=2, m=True), R(s="ui_design", l=1), R(s="git", l=1)]),
    dict(key="intern", company="test_srl", type="internship", title="Data analyst internship (summer practice)",
         description="Summer practice for 2nd or 3rd year students. You will make weekly sales reports in Excel and "
                     "learn Power BI with our team. A mentor helps you every week.",
         tasks=["Weekly sales reports in Excel", "Clean the stock data", "Build a first Power BI report with your mentor"],
         outcome="Practice certificate", domain="retail", difficulty=1, hours=20, weeks=8, start=30, mode="hybrid",
         city="Bucharest", comp=("monthly", 2500), academic=["mandatory_practice"], mentoring=True,
         reqs=[R(s="excel", l=2, m=True), R(s="power_bi", l=1, m=True, learn=True), R(s="communication", l=1)]),
    dict(key="analyst_job", company="test_srl", type="job", title="Junior data analyst (part-time)",
         description="Part-time job, 20 hours a week. You will keep our sales reports up to date with SQL and Power BI.",
         tasks=["Update the weekly sales reports", "Answer data questions from the store managers"],
         outcome="", domain="retail", difficulty=2, hours=20, weeks=52, start=30, mode="hybrid", city="Bucharest",
         comp=("monthly", 4000), academic=[], mentoring=True,
         reqs=[R(s="sql", l=2, m=True), R(s="power_bi", l=2, m=True), R(s="excel", l=2)]),
    # ---------------------------------------------------------------- Demo Logistics SRL
    dict(key="autoreport", company="demo_logistics", type="project", title="Automate the daily truck report",
         description="Every morning someone copies data from 6 Excel files into one report. We want this done "
                     "automatically, with Python or Excel macros.",
         tasks=["Look at the 6 Excel files", "Write the automation", "Send the report by e-mail every morning"],
         outcome="Working script and a short video on how to use it", domain="logistics", difficulty=2, hours=8, weeks=2,
         start=5, mode="remote", city="Cluj-Napoca", comp=("fixed", 1200), academic=["course_credit"], mentoring=False,
         reqs=[R(s="process_automation", l=2, m=True), R(s="excel", l=2, m=True), R(s="python", l=2), R(s="vba", l=1)],
         request_verification=True),
    dict(key="dbclean", company="demo_logistics", type="project", title="Curatarea bazei de date cu clienti",
         description="Avem aproximativ 8.000 de clienti in mai multe fisiere Excel, cu dubluri si date lipsa. Vrem o baza "
                     "de date curata in MySQL. SQL este obligatoriu.",
         tasks=["Combine the Excel files", "Remove duplicates and fix missing data", "Create the MySQL tables",
                "Import and check the data"],
         outcome="Clean MySQL database", domain="logistics", difficulty=2, hours=10, weeks=4, start=14, mode="remote",
         city="Cluj-Napoca", comp=("fixed", 2000), academic=[], mentoring=False,
         reqs=[R(s="sql", l=2, m=True), R(s="data_cleaning", l=2), R(s="database_design", l=1), R(s="python", l=1, learn=True)]),
    dict(key="logintern", company="demo_logistics", type="internship", title="Logistics data internship",
         description="Practice internship in our Cluj office. You will look at delivery times and fuel costs in Excel. "
                     "We can teach you some Python.",
         tasks=["Collect delivery and fuel data", "Find the most expensive routes", "Present the results to the team"],
         outcome="Practice certificate", domain="logistics", difficulty=1, hours=20, weeks=6, start=45, mode="onsite",
         city="Cluj-Napoca", comp=("monthly", 2000), academic=["mandatory_practice"], mentoring=True,
         reqs=[R(s="excel", l=2, m=True), R(s="data_analysis", l=1), R(s="python", l=1, learn=True)]),
    dict(key="pyjob", company="demo_logistics", type="job", title="Python developer (part-time)",
         description="Part-time, 20 hours a week, remote. You will build small internal tools in Python: reports, "
                     "scripts and simple APIs.",
         tasks=["Build and maintain internal tools", "Automate reports"],
         outcome="", domain="logistics", difficulty=2, hours=20, weeks=52, start=30, mode="remote", city="Cluj-Napoca",
         comp=("monthly", 4500), academic=[], mentoring=False,
         reqs=[R(s="python", l=2, m=True), R(s="sql", l=2), R(s="backend_api", l=1), R(s="git", l=1)]),
]

# past and running collaborations: (key, company, student, title, skills, domain, status, company rating, student rating)
HISTORY = [
    ("h1", "test_srl", "test_student", "Monthly sales report in Excel", ["excel", "dashboards"], "retail", "completed",
     {"quality": 5, "deadline": 5, "communication": 4}, {"clarity": 5, "collaboration": 5, "payment": 5}),
    ("h2", "demo_logistics", "maria", "Delivery prices scraper", ["web_scraping", "python"], "logistics", "completed",
     {"quality": 5, "deadline": 4, "communication": 5}, {"clarity": 4, "collaboration": 5, "payment": 5}),
    ("h3", "demo_logistics", "test_student", "Fuel cost dashboard", ["power_bi", "data_visualization"], "logistics",
     "in_progress", None, None),
]

# (opportunity, student, kind, status, message)
PENDING = [
    ("site", "maria", "application", "pending", "I have built two React shops before. Happy to help."),
    ("pyjob", "maria", "application", "pending", "I write Python tools every week, see my GitHub."),
    ("intern", "test_student", "invitation", "pending", "Hi! Your profile fits our summer practice. Interested?"),
]

# swipes made before the demo starts: (opportunity, student, who swiped, right?)
# Test SRL already likes Test Student for the Power BI project, so her right swipe on it is an instant match.
SWIPES = [
    ("pbi", "test_student", "company", True),
]

# (opportunity, student, accepted by the professor?, note)
MENTORSHIP = [
    ("autoreport", "test_student", False, "I would like help choosing between Python and Excel macros."),
]

DEMO_DATA = dict(students=STUDENTS, companies=COMPANIES, university=UNIVERSITY, opportunities=OPPORTUNITIES,
                 history=HISTORY, pending=PENDING, swipes=SWIPES, mentorship=MENTORSHIP, accounts=DEMO_ACCOUNTS)


def _req(r: dict) -> OpportunitySkill:
    return OpportunitySkill(skill_id=r["s"], min_level=r.get("l", 1), mandatory=r.get("m", False),
                            learnable=r.get("learn", False), source="manual")


def _user(db, role: str, entry: dict, accounts: dict) -> User:
    username, password = accounts.get(entry["key"], (None, None))
    u = User(role=role, name=entry["name"], email=f"{entry['key']}@demo.local", headline=entry["headline"],
             username=username, password_hash=hash_password(password) if password else None)
    db.add(u)
    db.flush()
    return u


def seed(db, data: dict | None = None) -> None:
    data = data or DEMO_DATA
    accounts = data.get("accounts", {})
    for s in SKILLS:
        db.add(Skill(**{k: v for k, v in s.items() if k != "name_ro"}))  # Romanian names live in the catalog

    users: dict[str, User] = {}
    for st in data["students"]:
        u = users[st["key"]] = _user(db, "student", st, accounts)
        p = StudentProfile(
            user_id=u.id, university=st["university"], faculty=st["faculty"], study_program=st["study_program"],
            study_level=st.get("study_level", "bachelor"), year=st["year"], city=st["city"], bio=st["bio"],
            accepted_types=st["types"], goals=st["goals"], domains=st["domains"], courses=st["courses"],
            hours_per_week=st["hours"], available_from=d(-30), available_to=d(240), work_mode=st["mode"],
        )
        for sid, lvl in st["skills"].items():
            p.skills.append(StudentSkill(skill_id=sid, level=lvl, wants_to_learn=False))
        for sid, lvl in st.get("wants", {}).items():
            p.skills.append(StudentSkill(skill_id=sid, level=lvl, wants_to_learn=True))
        for title, desc, skills, domain in st.get("projects", []):
            p.past_projects.append(PastProject(title=title, description=desc, skills=skills, domain=domain))
        db.add(p)

    for c in data["companies"]:
        u = users[c["key"]] = _user(db, "company", c, accounts)
        db.add(CompanyProfile(user_id=u.id, industry=c["industry"], size=c["size"], city=c["city"],
                              website=c["website"], description=c["description"]))

    for un in data["university"]:
        users[un["key"]] = _user(db, "university", un, accounts)
    validator = users[data["university"][0]["key"]]

    opps: dict[str, Opportunity] = {}
    for o in data["opportunities"]:
        comp_type, amount = o["comp"]
        opp = Opportunity(
            company_id=users[o["company"]].id, type=o["type"], title=o["title"], description=o["description"],
            tasks=o["tasks"], expected_outcome=o["outcome"], domain=o["domain"], difficulty=o["difficulty"],
            hours_per_week=o["hours"], duration_weeks=o["weeks"], start_date=d(o["start"]),
            deadline=d(o["start"] + 7 * o["weeks"]) if o["type"] == "project" else None, work_mode=o["mode"],
            city=o["city"], compensation_type=comp_type, compensation_amount=amount, academic_options=o["academic"],
            mentoring_offered=o["mentoring"], status="open", university_verified=o.get("verified", False),
            verified_by=validator.id if o.get("verified") else None,
            verification_requested=o.get("request_verification", False),
        )
        for r in o["reqs"]:
            opp.skills.append(_req(r))
        db.add(opp)
        db.flush()
        opps[o["key"]] = opp

    for _key, comp, stud, title, skills, domain, status, c_rating, s_rating in data["history"]:
        o = Opportunity(
            company_id=users[comp].id, type="project", title=title,
            description=f"{title}. Completed through SkillSync." if status == "completed" else f"{title}.",
            tasks=[], domain=domain, difficulty=2, hours_per_week=8, duration_weeks=3, start_date=d(-90),
            deadline=d(-60) if status == "completed" else d(10), work_mode="remote", compensation_type="fixed",
            compensation_amount=1200, status=status, selected_student_id=users[stud].id,
        )
        for sid in skills:
            o.skills.append(OpportunitySkill(skill_id=sid, min_level=2, mandatory=True, source="manual"))
        db.add(o)
        db.flush()
        db.add(Application(opportunity_id=o.id, student_id=users[stud].id, kind="application", status="selected"))
        db.add(Message(opportunity_id=o.id, sender_id=users[comp].id, recipient_id=users[stud].id,
                       body=f"Thanks for working with us on \"{title}\"!" if status == "completed"
                       else "How is it going? Let us know if you need anything.", read=status == "completed"))
        if c_rating:
            db.add(Review(opportunity_id=o.id, reviewer_id=users[comp].id, reviewee_id=users[stud].id,
                          direction="company_to_student", ratings=c_rating,
                          overall=round(sum(c_rating.values()) / 3, 2), comment="Great work, delivered exactly what we needed."))
        if s_rating:
            db.add(Review(opportunity_id=o.id, reviewer_id=users[stud].id, reviewee_id=users[comp].id,
                          direction="student_to_company", ratings=s_rating,
                          overall=round(sum(s_rating.values()) / 3, 2), comment="Clear brief and paid on time."))

    for okey, skey, kind, status, msg in data["pending"]:
        o = opps[okey]
        db.add(Application(opportunity_id=o.id, student_id=users[skey].id, kind=kind, status=status, message=msg))
        company = db.get(User, o.company_id)
        sender, recipient = (users[skey], company) if kind == "application" else (company, users[skey])
        db.add(Message(opportunity_id=o.id, sender_id=sender.id, recipient_id=recipient.id, body=msg))

    for okey, skey, side, liked in data.get("swipes", []):
        db.add(Swipe(opportunity_id=opps[okey].id, student_id=users[skey].id, actor_role=side, liked=liked))

    for okey, skey, accepted, note in data["mentorship"]:
        db.add(MentorshipRequest(opportunity_id=opps[okey].id, student_id=users[skey].id, note=note,
                                 mentor_id=validator.id if accepted else None, status="accepted" if accepted else "pending"))

    db.merge(AppMeta(key="seed_version", value=SEED_VERSION if data is DEMO_DATA else "custom"))
    db.commit()


def reset_and_seed(data: dict | None = None) -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db, data)


def ensure_seeded() -> None:
    """Seed an empty database, and re-create an older one (schema or demo data changed)."""
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        meta = db.get(AppMeta, "seed_version")
        if meta is not None and meta.value == SEED_VERSION:
            return
    reset_and_seed()


if __name__ == "__main__":
    reset_and_seed()
    print("Demo data re-created.")
