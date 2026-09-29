import { AuditSeverity } from "@/lib/audit";

export interface AuditLogItem {
  id: string;
  type: string;
  category: string;
  title: string;
  content: string;
  author_name: string;
  created_by: string;
  owner_id: string;
  created_at: string;
  tenant_id: string;
  metadata?: {
    action?: string;
    severity?: AuditSeverity;
    entityType?: string;
    ip?: string;
    userAgent?: string;
    userEmail?: string;
    details?: any;
    [key: string]: any;
  };
}
