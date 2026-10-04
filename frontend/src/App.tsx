import { lazy, Suspense, type ReactNode } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Empty, Spinner } from "./components/ui";
import { useSession } from "./lib/session";
import type { Role } from "./lib/types";
import About from "./pages/About";
import CompanyDashboard from "./pages/CompanyDashboard";
import Explore from "./pages/Explore";
import Home from "./pages/Home";
import Messages from "./pages/Messages";
import OpportunityDetail from "./pages/OpportunityDetail";
import PostOpportunity from "./pages/PostOpportunity";
import StudentDashboard from "./pages/StudentDashboard";
import StudentProfileEdit from "./pages/StudentProfileEdit";
import StudentPublic from "./pages/StudentPublic";
import SystemStatusPage from "./pages/SystemStatus";
import Talent from "./pages/Talent";

// charts (recharts) only load for the university role
const UniversityDashboard = lazy(() => import("./pages/UniversityDashboard"));

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, ready } = useSession();
  if (!ready) return <Spinner />;
  if (!user || !roles.includes(user.role))
    return (
      <Empty
        title={`This page is for ${roles.join(" / ")} accounts`}
        action={
          <Link to="/" className="btn-primary">
            Choose a demo persona
          </Link>
        }
      >
        Use the persona switcher in the header to try GoBiz as a student, a company or the university.
      </Empty>
    );
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="explore" element={<Explore />} />
        <Route path="opportunities/:id" element={<OpportunityDetail />} />
        <Route path="student" element={<RequireRole roles={["student"]}><StudentDashboard /></RequireRole>} />
        <Route path="student/profile" element={<RequireRole roles={["student"]}><StudentProfileEdit /></RequireRole>} />
        <Route path="students/:id" element={<RequireRole roles={["company", "university", "student"]}><StudentPublic /></RequireRole>} />
        <Route path="company" element={<RequireRole roles={["company"]}><CompanyDashboard /></RequireRole>} />
        <Route path="company/new" element={<RequireRole roles={["company"]}><PostOpportunity /></RequireRole>} />
        <Route path="talent" element={<RequireRole roles={["company"]}><Talent /></RequireRole>} />
        <Route path="messages" element={<RequireRole roles={["student", "company"]}><Messages /></RequireRole>} />
        <Route path="university" element={<RequireRole roles={["university"]}><Suspense fallback={<Spinner />}><UniversityDashboard /></Suspense></RequireRole>} />
        <Route path="system" element={<SystemStatusPage />} />
        <Route path="about" element={<About />} />
        <Route path="*" element={<Empty title="Page not found" action={<Link className="btn-primary" to="/">Go home</Link>} />} />
      </Route>
    </Routes>
  );
}
