import { lazy, Suspense, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Empty, Spinner } from "./components/ui";
import { texts, useTexts } from "./lib/i18n";
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
import SwipePage from "./pages/Swipe";
import SystemStatusPage from "./pages/SystemStatus";
import Talent from "./pages/Talent";

// charts (recharts) only load for the university role
const UniversityDashboard = lazy(() => import("./pages/UniversityDashboard"));

const T = texts(
  { notForYou: "This page is not available for your account", otherAccount: "Log in with another test account to see it.", home: "Go home", notFound: "Page not found" },
  { notForYou: "Pagina nu este disponibilă pentru contul tău", otherAccount: "Intră cu alt cont de test ca să o vezi.", home: "Mergi la prima pagină", notFound: "Pagina nu a fost găsită" },
);

function NotFound() {
  const t = useTexts(T);
  return <Empty title={t.notFound} action={<Link className="btn-primary" to="/">{t.home}</Link>} />;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const t = useTexts(T);
  const { user, ready } = useSession();
  const location = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!roles.includes(user.role))
    return (
      <Empty title={t.notForYou} action={<Link to="/" className="btn-primary">{t.home}</Link>}>
        {t.otherAccount}
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
        <Route path="match" element={<RequireRole roles={["student", "company"]}><SwipePage /></RequireRole>} />
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
