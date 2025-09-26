import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect } from 'react';

export function CandidatProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading } = useAuth();

  useEffect(() => {
    console.log('CandidatProtectedRoute - loading:', loading);
    console.log('CandidatProtectedRoute - session:', session);
    console.log('CandidatProtectedRoute - profile:', profile);
  }, [loading, session, profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4">
          <Skeleton className="h-12 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </div>
    );
  }

  if (!session) {
    console.log('CandidatProtectedRoute - No session, redirecting to /auth');
    return <Navigate to="/auth" replace />;
  }

  // Vérifier que l'utilisateur est bien un candidat
  if (profile?.role !== 'CANDIDAT') {
    console.log('CandidatProtectedRoute - Not a candidate, role:', profile?.role, 'redirecting to /');
    return <Navigate to="/" replace />;
  }

  console.log('CandidatProtectedRoute - Access granted for candidate');
  return <>{children}</>;
}