import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
// import ReceiptUpload from '@/components/ReceiptUpload';
import { BarChart3, ArrowLeft } from 'lucide-react';

console.log('UploadPage component being defined');

export default function UploadPage() {
  console.log('UploadPage component executing');
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleUploadComplete = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Volver
              </Button>
              <div className="bg-gradient-primary rounded-lg p-2">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Subir Recibo</h1>
                <p className="text-sm text-muted-foreground">
                  Procesamiento inteligente con IA
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                {profile?.name}
              </span>
              <Button variant="outline" onClick={signOut}>
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Upload Page Test</h2>
          <p>This is a simplified upload page to test the component loading.</p>
          <Button onClick={handleUploadComplete} className="mt-4">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}