"use client";

import { ChangeEvent, FormEvent, ReactNode, useState, useRef } from "react";
import { apiClient } from "../../lib/api";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { GithubAuthButton } from "./GithubAuthButton";
import { Captcha, CaptchaRef } from "./Captcha";

type AccountType = "learner" | "mentor";

type VerificationDocument = {
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
};

const technicalFields = [
  "Software Engineering",
  "Web Development",
  "Data Structures & Algorithms",
  "Databases",
  "DevOps",
  "Web Security",
  "Mechanical Engineering",
  "Electrical Engineering",
  "Health Technology",
  "Other",
];

const experienceOptions = ["None", "<1 year", "1-3 years", "4-7 years", "8-10 years", ">10 years"];
const roleOptions = ["Student", "Professional", "Educator", "Researcher", "Other"];
const deviceOptions = ["Desktop/Laptop", "Smartphone", "Tablet"];

const inputClass =
  "w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500";

export function RegisterForm() {
  const [accountType, setAccountType] = useState<AccountType>("learner");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [primaryTechnicalField, setPrimaryTechnicalField] = useState(technicalFields[0]);
  const [roleOrStatus, setRoleOrStatus] = useState(roleOptions[0]);
  const [yearsOfExperience, setYearsOfExperience] = useState(experienceOptions[2]);
  const [devicesUsed, setDevicesUsed] = useState<string[]>(["Desktop/Laptop"]);
  const [collaborationGoals, setCollaborationGoals] = useState("");
  const [expertiseSubject, setExpertiseSubject] = useState("Software Engineering");
  const [expertiseLevel, setExpertiseLevel] = useState<"intermediate" | "advanced" | "expert">("advanced");
  const [skillTags, setSkillTags] = useState("");
  const [availabilityStatus, setAvailabilityStatus] = useState<"online" | "busy" | "offline">("online");
  const [verificationDocument, setVerificationDocument] = useState<VerificationDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaRef>(null);

  function toggleDevice(device: string) {
    setDevicesUsed((current) =>
      current.includes(device)
        ? current.filter((item) => item !== device)
        : [...current, device]
    );
  }

  function onDocumentChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setVerificationDocument(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Verification document must be 5MB or smaller.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setVerificationDocument({
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        dataUrl: String(reader.result),
      });
      setError(null);
    };
    reader.onerror = () => setError("Could not read the selected document.");
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!captchaToken) {
      setError("Please complete the CAPTCHA verification.");
      setLoading(false);
      return;
    }

    try {
      const isMentor = accountType === "mentor";
      await apiClient.post("/api/auth/register", {
        name,
        email,
        password,
        accountType,
        primaryTechnicalField,
        roleOrStatus,
        yearsOfExperience,
        devicesUsed,
        collaborationGoals: collaborationGoals || undefined,
        expertise: isMentor
          ? [{ subject: expertiseSubject, proficiency: expertiseLevel }]
          : [],
        skillTags: isMentor
          ? skillTags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        availabilityStatus: isMentor ? availabilityStatus : "offline",
        verificationDocument: isMentor ? verificationDocument : undefined,
        captchaToken,
      });
      window.location.href = "/login?registered=1";
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to sign up");
      // Reset CAPTCHA on error
      captchaRef.current?.reset();
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn(credential: string) {
    if (accountType === "mentor") {
      setError("Use the mentor registration form so you can upload a verification document.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post("/api/auth/google", { credential, accountType });
      if (res.data.isNewUser) {
        window.location.href = "/login?registered=google";
        return;
      }
      localStorage.setItem("mekari_token", res.data.token);
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Google sign-up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-sm">
      {error && (
        <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 rounded bg-neutral-100 p-1 dark:bg-neutral-900">
        {(["learner", "mentor"] as AccountType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setAccountType(type)}
            className={`rounded px-3 py-2 text-sm font-medium transition ${
              accountType === type
                ? "bg-white text-primary-700 shadow-sm dark:bg-neutral-800 dark:text-primary-300"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {type === "mentor" ? "Sign up as mentor" : "Sign up as learner"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Full name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email">
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Field label="Primary technical field">
          <select className={inputClass} value={primaryTechnicalField} onChange={(e) => setPrimaryTechnicalField(e.target.value)}>
            {technicalFields.map((field) => <option key={field}>{field}</option>)}
          </select>
        </Field>
        <Field label="Current role or status">
          <select className={inputClass} value={roleOrStatus} onChange={(e) => setRoleOrStatus(e.target.value)}>
            {roleOptions.map((role) => <option key={role}>{role}</option>)}
          </select>
        </Field>
        <Field label="Years of experience">
          <select className={inputClass} value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)}>
            {experienceOptions.map((years) => <option key={years}>{years}</option>)}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Devices used</span>
        <div className="flex flex-wrap gap-2">
          {deviceOptions.map((device) => (
            <label key={device} className="flex items-center gap-2 rounded border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700">
              <input type="checkbox" checked={devicesUsed.includes(device)} onChange={() => toggleDevice(device)} />
              {device}
            </label>
          ))}
        </div>
      </div>

      <Field label="How do you want to use Mekari?">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={collaborationGoals}
          onChange={(e) => setCollaborationGoals(e.target.value)}
          placeholder="Quick questions, in-depth troubleshooting, mentorship..."
        />
      </Field>

      {accountType === "mentor" && (
        <div className="space-y-3 rounded border border-neutral-200 p-4 dark:border-neutral-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Expertise area">
              <select className={inputClass} value={expertiseSubject} onChange={(e) => setExpertiseSubject(e.target.value)}>
                {technicalFields.map((field) => <option key={field}>{field}</option>)}
              </select>
            </Field>
            <Field label="Expertise level">
              <select className={inputClass} value={expertiseLevel} onChange={(e) => setExpertiseLevel(e.target.value as typeof expertiseLevel)}>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </Field>
            <Field label="Availability">
              <select className={inputClass} value={availabilityStatus} onChange={(e) => setAvailabilityStatus(e.target.value as typeof availabilityStatus)}>
                <option value="online">Online</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </Field>
            <Field label="Skill tags">
              <input className={inputClass} value={skillTags} onChange={(e) => setSkillTags(e.target.value)} placeholder="React, MongoDB, auth" />
            </Field>
          </div>
          <Field label="Verification document">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className={inputClass}
              onChange={onDocumentChange}
              required={accountType === "mentor"}
            />
          </Field>
          {verificationDocument && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Ready for admin review: {verificationDocument.fileName}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Captcha
          ref={captchaRef}
          onChange={setCaptchaToken}
          onExpired={() => setCaptchaToken(null)}
          onError={() => setError("CAPTCHA verification failed. Please try again.")}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {loading ? "Creating account..." : accountType === "mentor" ? "Create mentor account" : "Create learner account"}
      </button>
      <div className="space-y-2 pt-2">
        <GoogleAuthButton onCredential={onGoogleSignIn} onError={setError} />
        {accountType === "learner" ? (
          <GithubAuthButton accountType={accountType} mode="register" />
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            GitHub mentor sign-up is unavailable because mentor verification requires a document upload.
          </p>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">{label}</span>
      {children}
    </label>
  );
}
