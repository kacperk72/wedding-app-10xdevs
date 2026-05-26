import { Meeting } from './meeting.model';

export type AttentionItemType = 'task' | 'vendor' | 'payment';

export interface DashboardKpis {
  guests: {
    invited: number;
    confirmed: number;
    pending: number;
    declined: number;
  };
  budget: {
    plannedTotal: number;
    spentTotal: number;
  };
  payments: {
    upcomingCount: number;
    upcomingAmount: number;
    overdueCount: number;
    overdueAmount: number;
  };
  tasks: {
    activeCount: number;
    overdueCount: number;
  };
}

export interface AttentionItem {
  type: AttentionItemType;
  title: string;
  meta: string;
  route: string;
}

export interface Dashboard {
  kpis: DashboardKpis;
  attentionItems: AttentionItem[];
  upcomingMeetings: Meeting[];
}
