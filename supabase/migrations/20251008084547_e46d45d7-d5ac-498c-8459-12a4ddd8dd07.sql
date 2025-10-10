-- Create invitations table for persistent invite tokens
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'EMPLOYEE',
  department TEXT,
  region TEXT,
  account_id UUID NOT NULL,
  created_by UUID NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- null = never expires
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view invitations in their account
CREATE POLICY "Admins can view invitations in their account"
  ON public.invitations
  FOR SELECT
  USING (
    is_master_user(auth.uid()) OR
    is_any_admin(auth.uid(), account_id)
  );

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON public.invitations
  FOR INSERT
  WITH CHECK (
    is_master_user(auth.uid()) OR
    is_any_admin(auth.uid(), account_id)
  );

-- Admins can update invitations in their account
CREATE POLICY "Admins can update invitations"
  ON public.invitations
  FOR UPDATE
  USING (
    is_master_user(auth.uid()) OR
    is_any_admin(auth.uid(), account_id)
  );

-- Anyone can view a valid invitation by token (for accept page)
CREATE POLICY "Anyone can view invitation by token"
  ON public.invitations
  FOR SELECT
  USING (used_at IS NULL AND (expires_at IS NULL OR expires_at > now()));

-- Index for faster token lookups
CREATE INDEX idx_invitations_token ON public.invitations(token) WHERE used_at IS NULL;

-- Trigger for updated_at
CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();