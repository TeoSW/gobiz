import { lazy, Suspense, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Empty, Spinner } from "./components/ui";
import { useSession } from "./lib/session";
import type { Role } from "./lib/types";
import About from "./pages/About";
import CompanyDashboard from "./pages/CompanyDashboard";
import Explore from "./pages/Explore";
import Home from "./pages/Home";
import Login from "./pages/Login";
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
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!roles.includes(user.role))
    return (
      <Empty title="This page is not available for your account" action={<Link to="/" className="btn-primary">Go home</Link>}>
        Log in with another test account to see it.
      </Empty>
    );
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
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
