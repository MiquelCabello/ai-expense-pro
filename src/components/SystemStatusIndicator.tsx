import { Badge } from '@/components/ui/badge';
import { Database, DatabaseBackup } from 'lucide-react';

interface SystemStatusIndicatorProps {
  usingNewSystem: boolean;
}

export function SystemStatusIndicator({ usingNewSystem }: SystemStatusIndicatorProps) {
  return (
    <Badge 
      variant={usingNewSystem ? "default" : "secondary"}
      className="gap-1 text-xs"
    >
      {usingNewSystem ? (
        <>
          <Database className="h-3 w-3" />
          Sistema Nuevo
        </>
      ) : (
        <>
          <DatabaseBackup className="h-3 w-3" />
          Sistema Legacy
        </>
      )}
    </Badge>
  );
}
