import { useAuth } from '@/app/contexts/AuthContext';
import { Users, Filter, Activity, Plus } from 'lucide-react';
import { Button } from '@/app/components/ui';

export default function WelcomeDashboard() {
  const { user } = useAuth();

  const stats = [
    {
      name: 'Total Cohorts',
      value: '0',
      icon: Users,
      bgColor: 'bg-info',
    },
    {
      name: 'Active Filters',
      value: '0',
      icon: Filter,
      bgColor: 'bg-primary',
    },
    {
      name: 'Recent Queries',
      value: '0',
      icon: Activity,
      bgColor: 'bg-success',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-secondary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Message */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary">
            Welcome back, {user?.first_name || user?.username}! 👋
          </h1>
          <p className="text-text-light mt-2">
            Build powerful patient cohorts with natural language queries
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="card hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-light">{stat.name}</p>
                  <p className="text-3xl font-bold text-text mt-2">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-primary mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button variant="accent" size="lg" className="w-full shadow-md">
              <Plus className="w-5 h-5 mr-2" />
              <span>Create New Cohort</span>
            </Button>
            <Button variant="secondary" size="lg" className="w-full">
              <Filter className="w-5 h-5 mr-2" />
              <span>Browse Database Schema</span>
            </Button>
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-primary-light rounded-lg shadow-sm p-6 border border-border mb-8">
          <h2 className="text-xl font-semibold text-primary mb-4">Getting Started</h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h3 className="font-medium text-primary">Explore the Database Schema</h3>
                <p className="text-sm text-text-light mt-1">
                  Browse available tables and fields in the left panel
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h3 className="font-medium text-primary">Use Natural Language Queries</h3>
                <p className="text-sm text-text-light mt-1">
                  Ask questions like "Show me patients with diabetes aged 40-60"
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold">
                3
              </div>
              <div>
                <h3 className="font-medium text-primary">Build and Refine Your Cohort</h3>
                <p className="text-sm text-text-light mt-1">
                  Add filters and see results update in real-time
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity (Placeholder) */}
        <div className="card">
          <h2 className="text-xl font-semibold text-primary mb-4">Recent Activity</h2>
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-text-light mx-auto mb-3" />
            <p className="text-text">No recent activity yet</p>
            <p className="text-sm text-text-light mt-1">
              Start creating cohorts to see your activity here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
