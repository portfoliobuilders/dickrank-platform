import { EarningsDashboard } from '@/components/payments/EarningsDashboard';

export const dynamic = 'force-dynamic';

export default function CreatorDashboardPage() {
  return <EarningsDashboard preview={process.env.PAYMENTS_UI_PREVIEW === 'true'} />;
}
