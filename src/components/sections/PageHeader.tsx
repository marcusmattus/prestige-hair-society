/**
 * The banded page header shared by every secondary public page, so /stylists,
 * /about and /policies all open the same way the catalogue does.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line bg-sand">
      <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 lg:py-20">
        {eyebrow && (
          <div className="mb-4 text-[12px] tracking-[0.22em] text-sage uppercase">
            {eyebrow}
          </div>
        )}
        <h1 className="mb-5 font-serif text-[40px] leading-[1.05] font-light md:text-[56px]">
          {title}
        </h1>
        {lede && (
          <div className="max-w-[560px] text-[16px] leading-[1.7] text-muted">
            {lede}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Long-form legal and policy copy, at a comfortable reading measure. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mx-auto max-w-[720px] px-5 py-14 md:px-10 lg:py-20 [&_a]:text-moss [&_a]:underline [&_a]:underline-offset-2
        [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-[26px] [&_h2]:font-light first:[&_h2]:mt-0
        [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-[15px] [&_h3]:font-semibold
        [&_li]:mb-2 [&_li]:text-[16px] [&_li]:leading-[1.75] [&_li]:text-muted
        [&_p]:mb-4 [&_p]:text-[16px] [&_p]:leading-[1.75] [&_p]:text-muted
        [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5"
    >
      {children}
    </div>
  );
}
