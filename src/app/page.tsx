const coreSkills = [
  "SAP ABAP on HANA",
  "S/4HANA conversions",
  "CDS Views and AMDP",
  "OData and Fiori integration",
  "BAPI, BAdI, User Exits",
  "Workflow and IDoc/ALE",
  "Performance tuning",
  "Technical leadership",
];

const projectHighlights = [
  {
    title: "Global S/4HANA transformation",
    detail:
      "Led custom code remediation, interface redesign, and performance optimization for a multi-country rollout.",
    tags: ["S/4HANA", "ATC", "CDS", "Brownfield"],
  },
  {
    title: "Manufacturing process automation",
    detail:
      "Built resilient ABAP objects, reports, and workflows that improved shop-floor visibility and reduced manual reconciliations.",
    tags: ["MM", "PP", "Workflow", "Forms"],
  },
  {
    title: "Finance and logistics integration",
    detail:
      "Delivered complex enhancements across FI, SD, and MM with clean interfaces, audit-friendly controls, and stable month-end support.",
    tags: ["FI", "SD", "MM", "IDoc"],
  },
];

const services = [
  {
    name: "Architecture and solution design",
    copy: "Translate business requirements into maintainable SAP technical designs with clear effort, risk, and dependency mapping.",
  },
  {
    name: "Custom development",
    copy: "Design and build reports, enhancements, interfaces, conversions, forms, and object-oriented ABAP components.",
  },
  {
    name: "Modernization",
    copy: "Upgrade legacy custom code for S/4HANA readiness, HANA performance, API-led integration, and cleaner extensibility.",
  },
  {
    name: "Delivery governance",
    copy: "Guide teams through estimation, code reviews, defect triage, transport discipline, and production stabilization.",
  },
];

const metrics = [
  ["14+", "years of SAP delivery"],
  ["30+", "end-to-end project phases"],
  ["8+", "SAP modules supported"],
  ["24x7", "production-first mindset"],
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8f4] text-[#17201b]">
      <section className="relative overflow-hidden border-b border-[#d8ded4] bg-[#eef3ea]">
        <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(#cbd5c5_1px,transparent_1px),linear-gradient(90deg,#cbd5c5_1px,transparent_1px)] [background-size:44px_44px]" />
        <div className="relative mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-8 sm:px-10 lg:grid-cols-[1.04fr_0.96fr] lg:px-12">
          <div className="max-w-3xl">
            <nav className="mb-14 flex items-center justify-between gap-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#526053]">
              <span>SAP ABAP Consultant</span>
              <a
                href="#contact"
                className="rounded-full border border-[#93a18e] px-4 py-2 text-xs tracking-[0.14em] transition hover:border-[#17201b] hover:bg-[#17201b] hover:text-white"
              >
                Contact
              </a>
            </nav>
            <p className="mb-5 inline-flex rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#47624b] shadow-sm ring-1 ring-[#d9e0d5]">
              14+ years delivering SAP programs across enterprise landscapes
            </p>
            <h1 className="max-w-4xl text-5xl font-black leading-[0.98] text-[#111814] sm:text-6xl lg:text-7xl">
              Experienced SAP ABAP consultant for complex business-critical
              systems.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#4c5850] sm:text-xl">
              I help organizations design, build, modernize, and stabilize SAP
              solutions across S/4HANA, ECC, integrations, workflows, forms,
              enhancements, and performance-heavy custom development.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#expertise"
                className="inline-flex items-center justify-center rounded-md bg-[#17201b] px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-lg shadow-[#17201b]/15 transition hover:bg-[#2d4937]"
              >
                View Expertise
              </a>
              <a
                href="#projects"
                className="inline-flex items-center justify-center rounded-md border border-[#9aa696] bg-white/70 px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-[#17201b] transition hover:border-[#17201b] hover:bg-white"
              >
                Project Work
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[2rem] border border-[#cad3c5] bg-white p-5 shadow-2xl shadow-[#72836f]/20">
              <div className="rounded-[1.5rem] bg-[#17201b] p-5 text-white">
                <div className="flex items-center justify-between border-b border-white/15 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-[#aebdae]">
                      Delivery cockpit
                    </p>
                    <p className="mt-1 text-2xl font-bold">ABAP Excellence</p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-[#d7ff6a] text-sm font-black text-[#17201b]">
                    SAP
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  {["Design", "Build", "Optimize", "Stabilize"].map(
                    (stage, index) => (
                      <div
                        key={stage}
                        className="grid grid-cols-[88px_1fr_44px] items-center gap-3"
                      >
                        <span className="text-sm text-[#d7dfd3]">{stage}</span>
                        <span className="h-2 rounded-full bg-white/10">
                          <span
                            className="block h-2 rounded-full bg-[#d7ff6a]"
                            style={{ width: `${88 - index * 11}%` }}
                          />
                        </span>
                        <span className="text-right text-xs font-bold text-[#d7ff6a]">
                          OK
                        </span>
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3">
                  {metrics.map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
                    >
                      <p className="text-3xl font-black text-[#d7ff6a]">
                        {value}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-[#c8d2c5]">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="expertise" className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#5e755d]">
              Expertise
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
              Deep ABAP capability with business context.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {coreSkills.map((skill) => (
              <div
                key={skill}
                className="rounded-lg border border-[#d8ded4] bg-white px-5 py-4 text-base font-semibold shadow-sm"
              >
                {skill}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#d8ded4] bg-white">
        <div className="mx-auto grid max-w-7xl gap-0 px-6 py-20 sm:px-10 lg:grid-cols-4 lg:px-12">
          {services.map((service) => (
            <article
              key={service.name}
              className="border-[#d8ded4] py-7 lg:border-l lg:px-7 first:lg:border-l-0"
            >
              <h3 className="text-xl font-black">{service.name}</h3>
              <p className="mt-4 leading-7 text-[#526053]">{service.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="projects" className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-12">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#5e755d]">
              Project Experience
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
              Built for the realities of enterprise SAP delivery.
            </h2>
          </div>
          <p className="max-w-md leading-7 text-[#526053]">
            Comfortable across blueprinting, realization, testing, cutover,
            hypercare, and long-term support.
          </p>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {projectHighlights.map((project) => (
            <article
              key={project.title}
              className="rounded-lg border border-[#d8ded4] bg-white p-6 shadow-sm"
            >
              <h3 className="text-2xl font-black">{project.title}</h3>
              <p className="mt-4 leading-7 text-[#526053]">{project.detail}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#edf2e9] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#47624b]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#17201b] px-6 py-20 text-white sm:px-10 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#d7ff6a]">
              Delivery Style
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
              Practical, calm, and accountable from design to go-live.
            </h2>
          </div>
          <div className="grid gap-5">
            {[
              "Clear technical designs that business and delivery teams can both trust.",
              "Clean, reviewable ABAP with attention to performance, supportability, and upgrade readiness.",
              "Strong coordination with functional consultants, basis, security, QA, and business users.",
            ].map((item, index) => (
              <div key={item} className="flex gap-5 border-t border-white/15 pt-5">
                <span className="text-xl font-black text-[#d7ff6a]">
                  0{index + 1}
                </span>
                <p className="text-lg leading-8 text-[#d8e1d5]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-6 py-20 sm:px-10 lg:px-12">
        <div className="grid gap-8 rounded-lg border border-[#d8ded4] bg-white p-8 shadow-sm md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#5e755d]">
              Available for consulting and project leadership
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
              Need reliable SAP ABAP delivery for your next project?
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-[#526053]">
              Use this site as a professional profile foundation. Add the
              consultant name, email, certifications, and selected client
              domains when you are ready to personalize it.
            </p>
          </div>
          <a
            href="mailto:consultant@example.com"
            className="inline-flex items-center justify-center rounded-md bg-[#d7ff6a] px-6 py-3 text-sm font-black uppercase tracking-[0.14em] text-[#17201b] transition hover:bg-[#c7ef58]"
          >
            Email Consultant
          </a>
        </div>
      </section>
    </main>
  );
}
