import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:ml-64">
        <div className="container mx-auto p-6 pt-16 md:pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}