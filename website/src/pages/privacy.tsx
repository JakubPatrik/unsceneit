import type { ReactNode } from "react"

import { Footer } from "@/components/site/footer"
import { Nav } from "@/components/site/nav"
import { COMPANY, PRIVACY_UPDATED, SUPPORT_EMAIL } from "@/site"

// The privacy policy for the unscene.it extension and this website. It
// describes what extension/ actually sends (background.js lookups and
// searches; classify-frames for live AI) — keep it in sync with the code.
export function Privacy() {
  const email = (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="text-foreground underline underline-offset-4">
      {SUPPORT_EMAIL}
    </a>
  )

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-4 pt-36 pb-24 sm:px-6 sm:pt-44">
        <p className="mb-4 text-sm font-medium text-brand-soft">Privacy policy</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Your privacy at unscene.it</h1>
        <p className="mt-5 text-muted-foreground">Last updated {PRIVACY_UPDATED}</p>

        <div className="mt-10 rounded-2xl border border-border bg-card/60 p-6">
          <p className="font-medium">The short version</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>To find a video in our library, the extension sends its YouTube ID or its page title. Nothing else about you.</li>
            <li>No account, no name, no browsing history. We only have your email address if you join the waitlist.</li>
            <li>No video files are uploaded, and no person watches what you watch.</li>
            <li>We never sell your data or use it for advertising.</li>
          </ul>
        </div>

        <div className="mt-14 space-y-12 text-[1.0625rem] leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
          <Part title="Who we are">
            <p>
              unscene.it is a browser extension that hides the scenes you choose in online videos, and this website at
              unscene.it. Both are run by <strong>{COMPANY.name}</strong>, {COMPANY.address}, which is responsible for
              your data (the &ldquo;data controller&rdquo;). In this policy, &ldquo;we&rdquo; means {COMPANY.name}. You
              can reach us at {email} with any question or request about your data.
            </p>
          </Part>

          <Part title="What the extension sends to us, and why">
            <p>The extension only sends what it needs to work:</p>
            <ul className="list-disc space-y-3 pl-5">
              <li>
                <strong>Which video is playing.</strong> When a video starts loading, the extension sends its YouTube video
                ID or, on other sites, the title of the page, so we can look it up in the unscene.it library and return the
                scenes your filters should hide. The page&rsquo;s address is not sent.
              </li>
              <li>
                <strong>Library searches.</strong> If you search the library to pick a video, we receive what you type.
              </li>
              <li>
                <strong>Technical information.</strong> Like any web service, our hosting provider receives your IP address
                and basic request details when the extension contacts it. We don&rsquo;t use them to identify you or to
                follow you across sites.
              </li>
            </ul>
            <p>
              These requests aren&rsquo;t tied to an account or to any identifier for you, and we don&rsquo;t store the
              lookups or searches themselves. They&rsquo;re used only to provide the extension&rsquo;s features.
            </p>
          </Part>

          <Part title="If you join the waitlist">
            <p>
              The early access waitlist on this website asks for your <strong>email address</strong>. We keep it, with the
              date you joined and whether you came from the website or the extension, to tell you when live AI and Pro
              launch and to give you the founding-member pricing we promised. We only email you about unscene.it early
              access and Pro.
            </p>
            <p>
              You can unsubscribe from any email, or ask us at {email} to remove your address, and we&rsquo;ll delete it.
              The waitlist is the only place we collect an email address, and it isn&rsquo;t linked to anything the
              extension sends.
            </p>
          </Part>

          <Part title="Live AI (Pro, when available)">
            <p>
              Live AI isn&rsquo;t available yet. When it is, and only if you turn it on for a video, the extension will send
              short, low-resolution still frames from that video to our servers. They pass them to an AI service provider,
              which checks them against the filters. The frames aren&rsquo;t kept. We keep only the results (which seconds
              of the video match which filter), together with the video&rsquo;s title and ID, in the shared library, where
              they help every viewer of that video. The results aren&rsquo;t linked to you. We&rsquo;ll update this policy
              before live AI and accounts launch.
            </p>
          </Part>

          <Part title="What stays on your device">
            <ul className="list-disc space-y-3 pl-5">
              <li>
                <strong>Your settings</strong>: your filters, how scenes are hidden and whether thumbnails are blurred. They
                are saved with Chrome&rsquo;s storage. If you use Chrome sync, Google syncs them between your browsers under
                Google&rsquo;s own privacy policy.
              </li>
              <li>
                <strong>Videos you pick from the library</strong>, remembered for the page you picked them on (the most
                recent 200) so the extension recognises the video next time. This list never leaves your device.
              </li>
            </ul>
            <p>Uninstalling the extension removes this data from your browser.</p>
          </Part>

          <Part title="What we don't do">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>We don&rsquo;t collect your name, account details or browsing history. Your email address only if you join the waitlist.</li>
              <li>We don&rsquo;t sell or rent your data, or share it for advertising, credit checks or lending.</li>
              <li>We don&rsquo;t use analytics, trackers or cookies in the extension, and no cookies or advertising trackers on this website.</li>
              <li>No person at unscene.it reviews what you watch.</li>
            </ul>
          </Part>

          <Part title="This website">
            <p>
              unscene.it uses <strong>Vercel Web Analytics</strong> to count visits to this website. It sets no cookies
              and doesn&rsquo;t identify you or follow you to other sites. It records which pages are visited, the
              referring site, and your browser, operating system, device type and country, all in aggregate. The
              extension doesn&rsquo;t use analytics.
            </p>
          </Part>

          <Part title="Chrome Web Store user data policy">
            <p>
              The use of information received from the unscene.it extension adheres to the{" "}
              <a
                href="https://developer.chrome.com/docs/webstore/program-policies/user-data-faq"
                className="text-foreground underline underline-offset-4"
                target="_blank"
                rel="noopener noreferrer"
              >
                Chrome Web Store User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </Part>

          <Part title="Service providers">
            <p>We use a small number of providers to run unscene.it, and they may process data only on our behalf:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Supabase</strong>: hosts our database and servers, including the library and the waitlist. Data is
                stored in Canada, which the EU recognises as providing adequate data protection.
              </li>
              <li>
                <strong>Vercel</strong>: hosts this website and provides its visitor analytics.
              </li>
              <li>
                <strong>An AI service provider</strong>, for live AI only, once it&rsquo;s available.
              </li>
            </ul>
          </Part>

          <Part title="How long we keep data">
            <p>
              Video lookups and searches aren&rsquo;t stored by us. Our hosting provider keeps standard request logs,
              including IP addresses, for a short period for security and reliability, then deletes them. Library entries
              (video titles, IDs and flagged scenes) are kept for as long as the library runs. Waitlist addresses are
              kept until you unsubscribe or ask us to delete them.
            </p>
          </Part>

          <Part title="Your rights">
            <p>
              Depending on where you live, including under the EU&rsquo;s GDPR, you can ask to access, correct or delete
              personal data we hold about you, object to how we use it, or complain to your local data protection
              authority. Because we don&rsquo;t link requests to you, we usually hold nothing we could identify as yours,
              but write to {email} and we&rsquo;ll help.
            </p>
          </Part>

          <Part title="Children">
            <p>
              unscene.it is meant to be set up by adults, including parents who use it to watch with their children. We
              don&rsquo;t knowingly collect personal information from children.
            </p>
          </Part>

          <Part title="Changes to this policy">
            <p>
              If we change how the extension handles data, we&rsquo;ll update this page and the date at the top before the
              change takes effect.
            </p>
          </Part>

          <Part title="Contact">
            <p>Questions or requests: {email}.</p>
            <p>
              Or by post: {COMPANY.name}, {COMPANY.address}.
            </p>
          </Part>
        </div>
      </main>
      <Footer />
    </>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  )
}
