import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ShieldCheck, Lock, ArrowLeft, Check, X } from 'lucide-react';

const validatePassword = (password: string) => {
  return {
    minLength: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
  };
};

const isPasswordValid = (password: string) => {
  const validation = validatePassword(password);
  return Object.values(validation).every(v => v);
};

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchInvitation = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setError('Token de invitación no proporcionado.');
        setLoading(false);
        return;
      }

      console.log('[AcceptInvite] Fetching invitation with token:', token);

      try {
        // Fetch invitation from public table
        const { data, error: fetchError } = await supabase
          .from('invitations')
          .select('*')
          .eq('token', token)
          .is('used_at', null)
          .maybeSingle();

        if (fetchError) {
          console.error('[AcceptInvite] Error fetching invitation:', fetchError);
          setError('Error al validar la invitación.');
          setLoading(false);
          return;
        }

        if (!data) {
          setError('Invitación no válida o ya utilizada.');
          setLoading(false);
          return;
        }

        // Check if expired
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setError('Esta invitación ha expirado.');
          setLoading(false);
          return;
        }

        console.log('[AcceptInvite] Valid invitation found for:', data.email);
        setInvitation(data);
        setLoading(false);
      } catch (err) {
        console.error('[AcceptInvite] Unexpected error:', err);
        setError('Error inesperado al procesar la invitación.');
        setLoading(false);
      }
    };

    fetchInvitation();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation) return;

    if (!isPasswordValid(password)) {
      toast.error('La contraseña no cumple con todos los requisitos de seguridad');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);

    try {
      console.log('[AcceptInvite] Completing invitation...');

      // Call edge function to complete invitation
      const { data, error } = await supabase.functions.invoke('complete-invitation', {
        body: {
          token: invitation.token,
          password: password,
        },
      });

      if (error) {
        console.error('[AcceptInvite] Error completing invitation:', error);
        console.error('[AcceptInvite] Error details:', JSON.stringify(error, null, 2));
        
        // Check for weak password error
        if (error.message?.includes('weak_password') || error.message?.includes('Password should contain')) {
          toast.error('La contraseña no cumple con los requisitos de seguridad. Asegúrate de incluir mayúsculas, minúsculas, números y caracteres especiales.');
        } else {
          toast.error('No se pudo completar la invitación. Por favor, contacta al administrador.');
        }
        setSubmitting(false);
        return;
      }

      console.log('[AcceptInvite] Response from edge function:', JSON.stringify(data, null, 2));

      if (!data.success) {
        console.error('[AcceptInvite] Invitation failed:', data.error);
        const errorMessage = data.error === 'user_already_exists' 
          ? 'Ya existe una cuenta con este email.'
          : data.error === 'invitation_update_failed'
          ? 'Error al actualizar la invitación.'
          : data.error?.includes('weak_password') || data.error?.includes('Password should contain')
          ? 'La contraseña no cumple con los requisitos de seguridad. Debe incluir mayúsculas, minúsculas, números y caracteres especiales.'
          : data.error || 'Error al crear la cuenta.';
        toast.error(errorMessage);
        setSubmitting(false);
        return;
      }

      console.log('[AcceptInvite] Invitation completed successfully for:', data.email);

      toast.success('¡Cuenta activada correctamente! Redirigiendo al login...');

      // Always redirect to login so user can sign in with their new password
      setTimeout(() => {
        navigate('/auth', { replace: true });
      }, 2000);
    } catch (err) {
      console.error('[AcceptInvite] Unexpected error:', err);
      toast.error('Error inesperado al completar la invitación.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-success-light flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Validando invitación...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-success-light flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Button
            variant="ghost"
            onClick={() => navigate('/auth')}
            className="mb-6 gap-2 hover:bg-background/50"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio de sesión
          </Button>

          <Card className="shadow-xl bg-gradient-card border-0">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertCircle className="h-16 w-16 text-warning" />
              </div>
              <CardTitle>Invitación no válida</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Pide a tu administrador que te envíe un nuevo enlace de invitación.
              </p>
              <Button 
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Ir al login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light via-background to-success-light flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate('/auth')}
          className="mb-6 gap-2 hover:bg-background/50"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio de sesión
        </Button>

        <Card className="shadow-xl bg-gradient-card border-0">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <ShieldCheck className="h-16 w-16 text-success" />
            </div>
            <CardTitle>Activar Cuenta</CardTitle>
            <CardDescription>
              Establece tu contraseña para acceder
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-sm text-muted-foreground text-center mb-4">
                Estás configurando la cuenta <strong>{invitation.email}</strong>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Introduce tu contraseña"
                    className="pl-10"
                    required
                    disabled={submitting}
                  />
                </div>
                
                {password && (
                  <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2 text-xs">
                    <p className="font-medium text-foreground mb-2">Requisitos de contraseña:</p>
                    <div className="space-y-1">
                      <PasswordRequirement 
                        met={validatePassword(password).minLength} 
                        text="Mínimo 8 caracteres"
                      />
                      <PasswordRequirement 
                        met={validatePassword(password).hasLowercase} 
                        text="Al menos una letra minúscula (a-z)"
                      />
                      <PasswordRequirement 
                        met={validatePassword(password).hasUppercase} 
                        text="Al menos una letra mayúscula (A-Z)"
                      />
                      <PasswordRequirement 
                        met={validatePassword(password).hasNumber} 
                        text="Al menos un número (0-9)"
                      />
                      <PasswordRequirement 
                        met={validatePassword(password).hasSpecialChar} 
                        text="Al menos un carácter especial (!@#$...)"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña"
                    className="pl-10"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-gradient-primary hover:opacity-90"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  'Activar Cuenta'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={met ? 'text-success' : 'text-muted-foreground'}>
        {text}
      </span>
    </div>
  );
}
