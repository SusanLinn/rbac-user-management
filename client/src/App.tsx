
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    NavLink,
    Outlet,
} from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProtectedRoute from "./components/ProtectedRoute";
import RolesPage from "./pages/RolesPage";

const DashboardLayout = () => {
    const menuClass = ({ isActive }: { isActive: boolean }) =>
        `block rounded-lg px-4 py-3 text-sm font-medium transition ${
            isActive
                ? "bg-neutral-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
        }`;

    return (
        <div className="min-h-screen bg-white md:flex">

            {/* Sidebar */}
            <aside className="w-full shrink-0 border-b border-gray-200 bg-gray-50 md:min-h-screen md:w-60 md:border-r">

                <div className="border-b border-gray-200 px-6 py-6">
                    <h1 className="text-xl font-bold">
                        RBAC System
                    </h1>
                </div>

                <nav className="space-y-2 p-4">

                    <p className="px-4 py-2 text-xs font-semibold uppercase text-gray-400">
                        Menu
                    </p>

                    <NavLink
                        to="/dashboard"
                        className={menuClass}
                    >
                        Dashboard / Users
                    </NavLink>

                    <p className="px-4 pt-5 pb-2 text-xs font-semibold uppercase text-gray-400">
                        Administration
                    </p>

                    <NavLink
                        to="/roles"
                        className={menuClass}
                    >
                        Roles & Permissions
                    </NavLink>

                </nav>
            </aside>

            {/* Main Content */}
            <main className="min-w-0 flex-1">
                <Outlet />
            </main>

        </div>
    );
};

const App = () => {
    return (
        <BrowserRouter>
            <Routes>

                <Route
                    path="/"
                    element={<LoginPage />}
                />

                <Route
                    element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route
                        path="/dashboard"
                        element={<DashboardPage />}
                    />

                    <Route
                        path="/roles"
                        element={<RolesPage />}
                    />
                </Route>

                <Route
                    path="*"
                    element={<Navigate to="/" replace />}
                />

            </Routes>
        </BrowserRouter>
    );
};

export default App;
