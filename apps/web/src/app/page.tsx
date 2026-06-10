import Layout from "@/components/Layout";

export default function Home() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-synergy-text">Dashboard</h1>
          <p className="mt-1 text-synergy-muted">
            Welcome to Synergy Net — Production Finance Intelligence Platform
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active Projects", value: "—" },
            { label: "Territories", value: "—" },
            { label: "Analyses Run", value: "—" },
            { label: "Reports Generated", value: "—" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg bg-synergy-card border border-synergy-border p-6"
            >
              <p className="text-sm text-synergy-muted">{stat.label}</p>
              <p className="mt-2 text-3xl font-bold text-synergy-text">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
