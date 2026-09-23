import type { Metadata } from "next";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  DMCA_RESTORE_DELAY_DAYS,
  FINANCIAL_RECORD_RETENTION_YEARS,
  LOG_RETENTION_AFTER_DELETION_YEARS,
  REPEAT_INFRINGER_STRIKE_LIMIT,
} from "@/lib/retention";

export const metadata: Metadata = {
  title: "DMCA policy · DickRank",
  description: "How to send a copyright claim or a counter-notice to DickRank.",
};

export const dynamic = "force-dynamic";

export default function DmcaPolicyPage({
  searchParams,
}: {
  searchParams?: { submitted?: string; counter?: string; error?: string };
}) {
  return (
    <main className="compliance wrap">
      <h1>DMCA policy</h1>
      <p>
        Designated copyright contact: <a href="mailto:dmca@dickrank.online">dmca@dickrank.online</a>
      </p>
      <p>
        DickRank follows the Digital Millennium Copyright Act. If you believe a post uses your copyrighted
        work without permission, send a takedown request. We hide matching content while the claim is
        reviewed.
      </p>
      {searchParams?.submitted ? (
        <p className="banner">Claim {searchParams.submitted} was received and is pending review.</p>
      ) : null}
      {searchParams?.counter ? (
        <p className="banner">Counter-notice {searchParams.counter} was received.</p>
      ) : null}
      {searchParams?.error ? (
        <p className="banner error">That request could not be saved. Check the form and try again.</p>
      ) : null}

      <h2>How to submit a claim</h2>
      <ol>
        <li>Identify the copyrighted work you own.</li>
        <li>Give the exact page address of the material on DickRank.</li>
        <li>Include your name, email, phone, and mailing address.</li>
        <li>State that you believe the use is not authorized.</li>
        <li>State, under penalty of perjury, that you are the owner or an authorized agent.</li>
        <li>Sign by checking the box below. That electronic signature is enough.</li>
      </ol>
      <p>
        Reports of illegal content involving anyone under 18 are not copyright claims. Contact law
        enforcement and the National Center for Missing &amp; Exploited Children.
      </p>

      <form className="card" action="/api/dmca/claim" method="post">
        <h2>Takedown request</h2>
        <label htmlFor="contentUrl">Address of the content</label>
        <input id="contentUrl" name="contentUrl" type="url" required placeholder="https://" />
        <label htmlFor="description">Description of the copyrighted work and why it infringes</label>
        <textarea id="description" name="description" required minLength={20} />
        <label htmlFor="contactInfo">Your name, email, phone, and mailing address</label>
        <textarea id="contactInfo" name="contactInfo" required minLength={5} />
        <label htmlFor="signature">
          <input id="signature" name="signature" type="checkbox" value="true" required style={{ width: "auto" }} />{" "}
          I state, under penalty of perjury, that I am authorized to act for the copyright owner and that
          this notice is accurate. I have a good-faith belief the use is not authorized.
        </label>
        <button type="submit">Submit claim</button>
      </form>

      <h2>Counter-notification</h2>
      <p>
        If your content was hidden and you believe that was a mistake, sign in as the content owner and
        send a counter-notice. Your statement should include:
      </p>
      <ul>
        <li>Your name, address, phone number, and email.</li>
        <li>The claim id and the material that was removed.</li>
        <li>A statement under penalty of perjury that the material was removed by mistake or misidentification.</li>
        <li>A statement that you consent to the jurisdiction of the federal court in your district, or in the district where the claimant is located if you are outside the United States, and that you will accept service of process from the claimant.</li>
      </ul>
      <p>
        We forward the counter-notice to the person who filed the claim. The content stays hidden for{" "}
        {DMCA_RESTORE_DELAY_DAYS} days. If that person does not tell us a lawsuit was filed, we put the
        content back.
      </p>
      <form className="card" action="/api/dmca/counter" method="post">
        <label htmlFor="claimId">Claim id</label>
        <input id="claimId" name="claimId" required />
        <label htmlFor="statement">Counter-notice statement</label>
        <textarea id="statement" name="statement" required minLength={20} />
        <label htmlFor="counterContact">Your contact information</label>
        <textarea id="counterContact" name="contactInfo" required minLength={5} />
        <button type="submit">Send counter-notice</button>
      </form>

      <h2>Repeat infringers</h2>
      <p>
        An account with {REPEAT_INFRINGER_STRIKE_LIMIT} upheld copyright claims is terminated. Their posts
        are hidden, and the account is deleted on the normal schedule. That deletion cannot be cancelled.
      </p>

      <h2>Data retention</h2>
      <p>
        Financial records are kept for {FINANCIAL_RECORD_RETENTION_YEARS} years. After an account is
        deleted, audit logs are kept for {LOG_RETENTION_AFTER_DELETION_YEARS} year and then removed.
        Account deletion itself waits {ACCOUNT_DELETION_GRACE_DAYS} days, and you can cancel during that
        time unless the account was terminated for repeat infringement.
      </p>
    </main>
  );
}
