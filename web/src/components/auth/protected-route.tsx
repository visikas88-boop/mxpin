import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
    children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const navigate = useNavigate();

    useEffect(() => {
        // 检查用户是否已登录
        const userToken = localStorage.getItem('user_token') || localStorage.getItem('token');
        const adminToken = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

        // 如果既没有用户token也没有管理员token，跳转到登录页
        if (!userToken && !adminToken) {
            navigate('/login', { replace: true });
        }
    }, [navigate]);

    // 再次检查token（同步检查）
    const userToken = localStorage.getItem('user_token') || localStorage.getItem('token');
    const adminToken = localStorage.getItem('admin_token') || localStorage.getItem('auth_token');

    if (!userToken && !adminToken) {
        return null; // 在跳转前不渲染内容
    }

    return <>{children}</>;
}
