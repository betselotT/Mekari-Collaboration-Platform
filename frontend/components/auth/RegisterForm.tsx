"use client";

import { ChangeEvent, FormEvent, ReactNode, useState } from "react";
import { Check } from "lucide-react";
import { apiClient } from "../../lib/api";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { GithubAuthButton } from "./GithubAuthButton";
import { useLanguage } from "../../lib/i18n";

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

function normalizeFullName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function fullNameError(value: string, t: ReturnType<typeof useLanguage>["t"]) {
  const normalized = normalizeFullName(value);
  if (normalized.length < 2) return t("auth.nameTooShort");
  if (normalized.length > 50) return t("auth.nameTooLong");
  if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(normalized)) {
    return t("auth.nameLettersOnly");
  }
  return "";
}

function passwordErrors(value: string, t: ReturnType<typeof useLanguage>["t"]) {
  const errors: string[] = [];
  if (value.length < 8) errors.push(t("auth.passwordLength"));
  if (!/[A-Z]/.test(value)) errors.push(t("auth.passwordUpper"));
  if (!/[a-z]/.test(value)) errors.push(t("auth.passwordLower"));
  if (!/[0-9]/.test(value)) errors.push(t("auth.passwordNumber"));
  if (!/[^A-Za-z0-9]/.test(value)) errors.push(t("auth.passwordSpecial"));
  return errors;
}

const passwordRules = [
  { label: "8+ chars", test: (value: string) => value.length >= 8 },
  { label: "uppercase", test: (value: string) => /[A-Z]/.test(value) },
  { label: "lowercase", test: (value: string) => /[a-z]/.test(value) },
  { label: "number", test: (value: string) => /[0-9]/.test(value) },
  { label: "special", test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

export function RegisterForm() {
  const { t } = useLanguage();
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
  const normalizedName = normalizeFullName(name);
  const nameError = name ? fullNameError(name, t) : "";
  const currentPasswordErrors = password ? passwordErrors(password, t) : [];

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
      setError(t("auth.documentTooLarge"));
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
    reader.onerror = () => setError(t("auth.documentReadError"));
    reader.readAsDataURL(file);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nextNameError = fullNameError(name, t);
    const nextPasswordErrors = passwordErrors(password, t);
    if (nextNameError) {
      setError(nextNameError);
      return;
    }
    if (nextPasswordErrors.length > 0) {
      setError(nextPasswordErrors[0]);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const isMentor = accountType === "mentor";
      await apiClient.post("/api/auth/register", {
        name: normalizedName,
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
      });
      window.location.href = `/verify-email?email=${encodeURIComponent(email)}`;
    } catch (err: any) {
      setError(err.response?.data?.error?.message || t("auth.registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn(credential: string) {
    if (accountType === "mentor") {
      setError(t("auth.mentorGoogleBlocked"));
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
      setError(err.response?.data?.error?.message || t("auth.googleSignupFailed"));
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
            {type === "mentor" ? t("auth.mentorSignup") : t("auth.learnerSignup")}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("auth.fullName")}>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setName(normalizedName)}
            required
          />
          <p className={`text-xs ${nameError ? "text-red-600 dark:text-red-300" : "text-neutral-500 dark:text-neutral-400"}`}>
            {t("auth.nameHelp")}
          </p>
          {nameError && <p className="text-xs text-red-600 dark:text-red-300">{nameError}</p>}
        </Field>
        <Field label={t("auth.email")}>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label={t("auth.password")}>
          <input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
            {passwordRules.map((rule) => {
              const met = rule.test(password);
              return (
                <span
                  key={rule.label}
                  className={`inline-flex items-center gap-1 ${met ? "text-emerald-600 dark:text-emerald-300" : "text-neutral-500 dark:text-neutral-400"}`}
                >
                  <Check className={`h-3 w-3 ${met ? "opacity-100" : "opacity-25"}`} />
                  {rule.label}
                </span>
              );
            })}
          </div>
        </Field>
        <Field label={t("auth.primaryField")}>
          <select className={inputClass} value={primaryTechnicalField} onChange={(e) => setPrimaryTechnicalField(e.target.value)}>
            {technicalFields.map((field) => <option key={field}>{field}</option>)}
          </select>
        </Field>
        <Field label={t("auth.currentRole")}>
          <select className={inputClass} value={roleOrStatus} onChange={(e) => setRoleOrStatus(e.target.value)}>
            {roleOptions.map((role) => <option key={role}>{role}</option>)}
          </select>
        </Field>
        <Field label={t("auth.experience")}>
          <select className={inputClass} value={yearsOfExperience} onChange={(e) => setYearsOfExperience(e.target.value)}>
            {experienceOptions.map((years) => <option key={years}>{years}</option>)}
          </select>
        </Field>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{t("auth.devicesUsed")}</span>
        <div className="flex flex-wrap gap-2">
          {deviceOptions.map((device) => (
            <label key={device} className="flex items-center gap-2 rounded border border-neutral-300 px-3 py-2 text-xs dark:border-neutral-700">
              <input type="checkbox" checked={devicesUsed.includes(device)} onChange={() => toggleDevice(device)} />
              {device}
            </label>
          ))}
        </div>
      </div>

      <Field label={t("auth.goals")}>
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={collaborationGoals}
          onChange={(e) => setCollaborationGoals(e.target.value)}
          placeholder={t("auth.goalsPlaceholder")}
        />
      </Field>

      {accountType === "mentor" && (
        <div className="space-y-3 rounded border border-neutral-200 p-4 dark:border-neutral-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("auth.expertiseArea")}>
              <select className={inputClass} value={expertiseSubject} onChange={(e) => setExpertiseSubject(e.target.value)}>
                {technicalFields.map((field) => <option key={field}>{field}</option>)}
              </select>
            </Field>
            <Field label={t("auth.expertiseLevel")}>
              <select className={inputClass} value={expertiseLevel} onChange={(e) => setExpertiseLevel(e.target.value as typeof expertiseLevel)}>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </Field>
            <Field label={t("auth.availability")}>
              <select className={inputClass} value={availabilityStatus} onChange={(e) => setAvailabilityStatus(e.target.value as typeof availabilityStatus)}>
                <option value="online">Online</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </Field>
            <Field label={t("auth.skillTags")}>
              <input className={inputClass} value={skillTags} onChange={(e) => setSkillTags(e.target.value)} placeholder={t("auth.skillTagsPlaceholder")} />
            </Field>
          </div>
          <Field label={t("auth.verificationDocument")}>
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
              {t("auth.readyForReview", { fileName: verificationDocument.fileName })}
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2 w-full rounded bg-primary-500 px-3 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-60"
      >
        {loading ? t("auth.creatingAccount") : accountType === "mentor" ? t("auth.createMentor") : t("auth.createLearner")}
      </button>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <GoogleAuthButton onCredential={onGoogleSignIn} onError={setError} />
        {accountType === "learner" ? (
          <GithubAuthButton accountType={accountType} mode="register" />
        ) : (
          <p className="flex min-h-10 items-center text-xs text-neutral-500 dark:text-neutral-400">
            {t("auth.githubMentorUnavailable")}
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
