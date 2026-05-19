

"use client";

import { ChangeEvent, useState, useEffect } from "react";
import { apiClient } from "../../../lib/api";
import { registerForPushNotifications } from "../../../lib/pushNotifications";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Input } from "../../../components/ui/Input";
import { Edit, Lock, Globe, Bell, Save, X, Plus, CheckCircle2, Clock, Moon, Video, Award, Zap, Bot, Trophy, Star, TrendingUp, FileText } from "lucide-react";

type AccountType = "learner" | "mentor";

type VerificationDocument = {
  fileName: string;
  fileType: string;
  fileSize: number;
  dataUrl: string;
};

type NotificationCategory = "chat" | "documentStatus" | "moderation" | "admin";
type NotificationPreferences = Record<
  NotificationCategory,
  {
    internal: boolean;
    push: boolean;
  }
>;

const defaultNotificationPreferences: NotificationPreferences = {
  chat: { internal: true, push: false },
  documentStatus: { internal: true, push: false },
  moderation: { internal: true, push: false },
  admin: { internal: true, push: false },
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

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    avatarUrl: "",
    availabilityStatus: "online",
  });

  const [isEditingSkills, setIsEditingSkills] = useState(false);
  const [newSkill, setNewSkill] = useState("");
  const [newExpertiseSubject, setNewExpertiseSubject] = useState("");
  const [newExpertiseProficiency, setNewExpertiseProficiency] = useState("beginner");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resubmittingVerification, setResubmittingVerification] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    defaultNotificationPreferences
  );
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupForm, setSetupForm] = useState({
    accountType: "learner" as AccountType,
    primaryTechnicalField: technicalFields[0],
    roleOrStatus: roleOptions[0],
    yearsOfExperience: experienceOptions[2],
    devicesUsed: ["Desktop/Laptop"],
    collaborationGoals: "",
    expertiseSubject: "Software Engineering",
    expertiseLevel: "advanced" as "intermediate" | "advanced" | "expert",
    skillTags: "",
    availabilityStatus: "online" as "online" | "busy" | "offline",
  });
  const [verificationDocument, setVerificationDocument] = useState<VerificationDocument | null>(null);

  const availabilityConfig: Record<string, {
    label: string;
    Icon: typeof CheckCircle2;
    chip: string;
    dot: string;
  }> = {
    online: {
      label: "Available now",
      Icon: CheckCircle2,
      chip: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
      dot: "bg-emerald-500",
    },
    busy: {
      label: "Busy",
      Icon: Clock,
      chip: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
      dot: "bg-amber-500",
    },
    in_session: {
      label: "In session",
      Icon: Video,
      chip: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900 dark:bg-purple-950 dark:text-purple-200",
      dot: "bg-purple-500",
    },
    offline: {
      label: "Offline",
      Icon: Moon,
      chip: "border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
      dot: "bg-neutral-400",
    },
  };

  const currentAvailability =
    availabilityConfig[user?.availabilityStatus || formData.availabilityStatus] ||
    availabilityConfig.offline;
  const AvailabilityIcon = currentAvailability.Icon;
  const needsSetup =
    !user?.profileSetupCompleted ||
    !user?.primaryTechnicalField ||
    !user?.roleOrStatus ||
    !user?.yearsOfExperience ||
    !user?.devicesUsed?.length;
  const isMentor = user?.role === "expert";
  const verificationStatus = user?.expertVerification?.status;

  function toggleSetupDevice(device: string) {
    setSetupForm((current) => ({
      ...current,
      devicesUsed: current.devicesUsed.includes(device)
        ? current.devicesUsed.filter((item) => item !== device)
        : [...current.devicesUsed, device],
    }));
  }

  function onSetupDocumentChange(e: ChangeEvent<HTMLInputElement>) {
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
      setError("");
    };
    reader.onerror = () => setError("Could not read the selected document.");
    reader.readAsDataURL(file);
  }

  async function handleFinishSetup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const isMentor = setupForm.accountType === "mentor";
      const res = await apiClient.post("/api/users/me/setup", {
        accountType: setupForm.accountType,
        primaryTechnicalField: setupForm.primaryTechnicalField,
        roleOrStatus: setupForm.roleOrStatus,
        yearsOfExperience: setupForm.yearsOfExperience,
        devicesUsed: setupForm.devicesUsed,
        collaborationGoals: setupForm.collaborationGoals || undefined,
        expertise: isMentor
          ? [{ subject: setupForm.expertiseSubject, proficiency: setupForm.expertiseLevel }]
          : [],
        skillTags: isMentor
          ? setupForm.skillTags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        availabilityStatus: isMentor ? setupForm.availabilityStatus : "offline",
        verificationDocument: isMentor ? verificationDocument : undefined,
      });
      setUser(res.data.user);
      setShowSetup(false);
      setMessage(isMentor ? "Profile setup complete. Your mentor verification is pending review." : "Profile setup complete.");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to finish setup.");
    }
  }

  async function handleResubmitVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!verificationDocument) {
      setError("Choose a new verification document first.");
      setMessage("");
      return;
    }

    setResubmittingVerification(true);
    setError("");
    setMessage("");

    try {
      const res = await apiClient.post("/api/users/me/mentor-verification-document", {
        verificationDocument,
      });
      setUser(res.data.user);
      setVerificationDocument(null);
      setMessage("New verification document uploaded. Your mentor verification is pending review.");
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to upload verification document.");
    } finally {
      setResubmittingVerification(false);
    }
  }

  const handleAddSkill = async () => {
    if (!newSkill.trim()) return;
    const nextSkill = newSkill.trim();
    const existingSkills = user.skillTags || [];
    if (existingSkills.some((skill: string) => skill.toLowerCase() === nextSkill.toLowerCase())) {
      setError("That skill is already listed.");
      return;
    }

    const updatedSkills = [...existingSkills, nextSkill];
    try {
      const res = await apiClient.put("/api/users/me", { skillTags: updatedSkills });
      setUser(res.data.user);
      setNewSkill("");
      setError("");
      setMessage("Skill added.");
    } catch (err) {
      setMessage("");
      setError("Failed to add skill.");
    }
  };

  const handleRemoveSkill = async (skillToRemove: string) => {
    const updatedSkills = (user.skillTags || []).filter((s: string) => s !== skillToRemove);
    try {
      const res = await apiClient.put("/api/users/me", { skillTags: updatedSkills });
      setUser(res.data.user);
      setError("");
      setMessage("Skill removed.");
    } catch (err) {
      setMessage("");
      setError("Failed to remove skill.");
    }
  };

  const handleAddExpertise = async () => {
    if (!newExpertiseSubject.trim()) return;
    const updatedExpertise = [
      ...(user.expertise || []),
      { subject: newExpertiseSubject.trim(), proficiency: newExpertiseProficiency }
    ];
    try {
      const res = await apiClient.put("/api/users/me", { expertise: updatedExpertise });
      setUser(res.data.user);
      setNewExpertiseSubject("");
      setNewExpertiseProficiency("beginner");
      setError("");
      setMessage("Expertise added.");
    } catch (err) {
      setMessage("");
      setError("Failed to add expertise.");
    }
  };

  const handleRemoveExpertise = async (indexToRemove: number) => {
    const updatedExpertise = (user.expertise || []).filter((_: any, index: number) => index !== indexToRemove);
    try {
      const res = await apiClient.put("/api/users/me", { expertise: updatedExpertise });
      setUser(res.data.user);
      setError("");
      setMessage("Expertise removed.");
    } catch (err) {
      setMessage("");
      setError("Failed to remove expertise.");
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await apiClient.get("/api/users/me");
        if (res.data.user) {
          setUser(res.data.user);
          setNotificationPreferences({
            ...defaultNotificationPreferences,
            ...(res.data.user.notificationPreferences || {}),
          });
          setFormData({
            name: res.data.user.name || "",
            bio: res.data.user.bio || "",
            avatarUrl: res.data.user.avatarUrl || "",
            availabilityStatus: res.data.user.availabilityStatus || "online",
          });
        }
      } catch (err) {
        setError("Failed to fetch user profile.");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  async function updateNotificationPreference(
    category: NotificationCategory,
    channel: "internal" | "push",
    value: boolean
  ) {
    const previous = notificationPreferences;
    const next = {
      ...notificationPreferences,
      [category]: {
        ...notificationPreferences[category],
        [channel]: value,
      },
    };

    setNotificationPreferences(next);
    setSavingPreferences(true);
    setError("");
    setMessage("");

    try {
      if (channel === "push" && value) {
        const pushResult = await registerForPushNotifications();
        if (!pushResult.ok) {
          setNotificationPreferences(previous);
          setError(pushResult.reason || "Could not enable push notifications.");
          return;
        }
      }
      const res = await apiClient.put("/api/notifications/preferences", next);
      setNotificationPreferences({
        ...defaultNotificationPreferences,
        ...(res.data.preferences || {}),
      });
      setMessage("Notification preferences updated.");
    } catch (err: any) {
      setNotificationPreferences(previous);
      setError(err.response?.data?.error?.message || "Failed to update notification preferences.");
    } finally {
      setSavingPreferences(false);
    }
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const avatarUrl = formData.avatarUrl.trim();

    if (avatarUrl) {
      try {
        new URL(avatarUrl);
      } catch {
        setMessage("");
        setError("Avatar URL must be a valid URL, or leave it blank.");
        return;
      }
    }

    try {
      const res = await apiClient.put("/api/users/me", {
        name: formData.name.trim(),
        bio: formData.bio.trim(),
        availabilityStatus: formData.availabilityStatus,
        ...(avatarUrl ? { avatarUrl } : {}),
      });
      if (res.data.user) {
        setUser(res.data.user);
        setIsEditing(false);
        setError("");
        setMessage("Profile updated.");
      }
    } catch (err) {
      setMessage("");
      setError("Failed to update profile.");
    }
  };

  const handleCancelProfileEdit = () => {
    setFormData({
      name: user.name || "",
      bio: user.bio || "",
      avatarUrl: user.avatarUrl || "",
      availabilityStatus: user.availabilityStatus || "online",
    });
    setIsEditing(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <DashboardLayout title="Profile">
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout title="Profile">
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Profile not found</h2>
          <p className="text-neutral-600 dark:text-neutral-400">Please make sure you are logged in.</p>
        </div>
      </DashboardLayout>
    );
  }
  return (
    <DashboardLayout title="Profile">
      {/* Edit Profile Button */}
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Profile</h2>
        <div className="flex gap-2">
          <Button type="button" variant={needsSetup ? "primary" : "secondary"} size="md" onClick={() => setShowSetup((value) => !value)}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Finish setting up
          </Button>
          {!isEditing && (
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={() => {
                setFormData({
                  name: user.name || "",
                  bio: user.bio || "",
                  avatarUrl: user.avatarUrl || "",
                  availabilityStatus: user.availabilityStatus || "online",
                });
                setIsEditing(true);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>

      {(message || error) && (
        <div
          className={`mb-6 rounded-lg border p-4 text-sm ${
            error
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          {error || message}
        </div>
      )}

      {isMentor && (
        <Card className="mb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Mentor verification</h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {verificationStatus === "approved"
                  ? "Approved. Your mentor profile is visible to learners."
                  : verificationStatus === "rejected"
                    ? "Rejected. Review the reason below and upload a new document from Finish setting up."
                    : "Pending. An admin still needs to review your uploaded document."}
              </p>
              {verificationStatus === "rejected" && user.expertVerification?.reviewNote && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  Rejection reason: {user.expertVerification.reviewNote}
                </p>
              )}
              {verificationStatus === "rejected" && (
                <form onSubmit={handleResubmitVerification} className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Upload a new verification document</span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                      onChange={onSetupDocumentChange}
                    />
                  </label>
                  {verificationDocument && (
                    <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                      Ready for admin review: {verificationDocument.fileName}
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="mt-3"
                    isLoading={resubmittingVerification}
                    disabled={!verificationDocument}
                  >
                    Upload new document
                  </Button>
                </form>
              )}
            </div>
            <Badge
              variant={
                verificationStatus === "approved"
                  ? "success"
                  : verificationStatus === "rejected"
                    ? "error"
                    : "warning"
              }
            >
              {verificationStatus || "pending"}
            </Badge>
          </div>
        </Card>
      )}

      {(needsSetup || showSetup) && (
        <Card className="mb-8">
          <div className="mb-5">
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">Finish setting up</h3>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Complete your learner or mentor profile so Mekari can personalize matching and verification.
            </p>
          </div>

          <form onSubmit={handleFinishSetup} className="space-y-5">
            <div className="grid grid-cols-2 gap-2 rounded bg-neutral-100 p-1 dark:bg-neutral-900">
              {(["learner", "mentor"] as AccountType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSetupForm((current) => ({ ...current, accountType: type }))}
                  className={`rounded px-3 py-2 text-sm font-medium transition ${
                    setupForm.accountType === type
                      ? "bg-white text-primary-700 shadow-sm dark:bg-neutral-800 dark:text-primary-300"
                      : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                  }`}
                >
                  {type === "mentor" ? "Set up as mentor" : "Set up as learner"}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1">
                <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Primary technical field</span>
                <select className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" value={setupForm.primaryTechnicalField} onChange={(e) => setSetupForm({ ...setupForm, primaryTechnicalField: e.target.value })}>
                  {technicalFields.map((field) => <option key={field}>{field}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Current role or status</span>
                <select className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" value={setupForm.roleOrStatus} onChange={(e) => setSetupForm({ ...setupForm, roleOrStatus: e.target.value })}>
                  {roleOptions.map((role) => <option key={role}>{role}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Years of experience</span>
                <select className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" value={setupForm.yearsOfExperience} onChange={(e) => setSetupForm({ ...setupForm, yearsOfExperience: e.target.value })}>
                  {experienceOptions.map((years) => <option key={years}>{years}</option>)}
                </select>
              </label>
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Devices used</span>
              <div className="flex flex-wrap gap-2">
                {deviceOptions.map((device) => (
                  <label key={device} className="flex items-center gap-2 rounded border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800">
                    <input type="checkbox" checked={setupForm.devicesUsed.includes(device)} onChange={() => toggleSetupDevice(device)} />
                    {device}
                  </label>
                ))}
              </div>
            </div>

            <label className="block space-y-1">
              <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">How do you want to use Mekari?</span>
              <textarea
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                rows={3}
                value={setupForm.collaborationGoals}
                onChange={(e) => setSetupForm({ ...setupForm, collaborationGoals: e.target.value })}
                placeholder="Quick questions, in-depth troubleshooting, mentorship..."
              />
            </label>

            {setupForm.accountType === "mentor" && (
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Expertise area</span>
                    <select className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" value={setupForm.expertiseSubject} onChange={(e) => setSetupForm({ ...setupForm, expertiseSubject: e.target.value })}>
                      {technicalFields.map((field) => <option key={field}>{field}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Expertise level</span>
                    <select className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" value={setupForm.expertiseLevel} onChange={(e) => setSetupForm({ ...setupForm, expertiseLevel: e.target.value as typeof setupForm.expertiseLevel })}>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Skill tags</span>
                    <Input value={setupForm.skillTags} onChange={(e) => setSetupForm({ ...setupForm, skillTags: e.target.value })} placeholder="React, MongoDB, auth" />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">Verification document</span>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm dark:border-neutral-800 dark:bg-neutral-950 dark:text-white" onChange={onSetupDocumentChange} required />
                  </label>
                </div>
                {verificationDocument && (
                  <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                    Ready for admin review: {verificationDocument.fileName}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="primary">
                Save setup
              </Button>
              {!needsSetup && (
                <Button type="button" variant="secondary" onClick={() => setShowSetup(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </Card>
      )}

      {/* Profile Header */}
      <Card className="mb-8">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Avatar size="xl" initials={getInitials(user.name)} src={user.avatarUrl} />
          <div className="flex-1 w-full">
            {isEditing ? (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Full Name
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Avatar URL
                  </label>
                  <Input
                    value={formData.avatarUrl}
                    onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Bio
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-2 text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    rows={4}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell us about yourself"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" variant="primary">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleCancelProfileEdit}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h3 className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {user.name}
                  </h3>
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${currentAvailability.chip}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${currentAvailability.dot}`} />
                    <AvailabilityIcon className="h-4 w-4" />
                    {currentAvailability.label}
                  </div>
                </div>
                <p className="mb-4 text-neutral-600 dark:text-neutral-400">
                  {user.email}
                </p>
                <p className="mb-6 max-w-2xl text-neutral-600 dark:text-neutral-400">
                  {user.bio || "No bio added yet."}
                </p>
                
                <div className="flex flex-wrap items-center gap-2">
                  {user.expertise?.length > 0 ? (
                    user.expertise.slice(0, 4).map((exp: any, index: number) => (
                      <Badge key={`${exp.subject}-${index}`} variant="primary">
                        {exp.subject} · {exp.proficiency}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="default">No expertise yet</Badge>
                  )}
                
                </div>
              </>
            )}
          </div>
        </div>

     
      </Card>

      {/* Two Column Layout */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Settings Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Security & Preferences */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
              Security & Preferences
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Card hoverable>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900">
                      <Lock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-white">
                        Two-Factor Auth
                      </h4>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        {twoFactorEnabled ? "Enabled" : "Not enabled"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={twoFactorEnabled}
                    onClick={() => {
                      setTwoFactorEnabled((enabled) => !enabled);
                      setError("");
                      setMessage(
                        twoFactorEnabled
                          ? "Two-factor authentication disabled."
                          : "Two-factor authentication enabled."
                      );
                    }}
                    className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors ${
                      twoFactorEnabled
                        ? "border-primary-600 bg-primary-600"
                        : "border-neutral-300 bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        twoFactorEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </Card>

              <Card hoverable>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900">
                      <Globe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-white">
                        Language
                      </h4>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        English (US)
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <Card hoverable className="md:col-span-2">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900">
                    <Bell className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-neutral-900 dark:text-white">
                      Notifications
                    </h4>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      Choose which updates appear inside Mekari and which can also reach your browser.
                    </p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700">
                  {[
                    { key: "chat", label: "Chat messages" },
                    { key: "documentStatus", label: "Mentor document status" },
                    { key: "moderation", label: "Moderation strikes" },
                    { key: "admin", label: "Admin reports and mentor requests" },
                  ].map((item) => {
                    const key = item.key as NotificationCategory;
                    if (key === "admin" && user.role !== "admin" && user.role !== "mod") return null;
                    return (
                      <div
                        key={key}
                        className="grid gap-3 border-b border-neutral-200 px-4 py-3 last:border-b-0 dark:border-neutral-700 sm:grid-cols-[1fr_auto_auto]"
                      >
                        <span className="text-sm font-medium text-neutral-900 dark:text-white">
                          {item.label}
                        </span>
                        {(["internal", "push"] as const).map((channel) => (
                          <label
                            key={channel}
                            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"
                          >
                            <input
                              type="checkbox"
                              checked={notificationPreferences[key]?.[channel] ?? channel === "internal"}
                              disabled={savingPreferences}
                              onChange={(event) =>
                                updateNotificationPreference(key, channel, event.target.checked)
                              }
                              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                            />
                            {channel === "internal" ? "In app" : "Push"}
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>

          {/* Expertise & Skills */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                Expertise & Skills
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditingSkills(!isEditingSkills)}>
                {isEditingSkills ? "Done" : "Edit"}
              </Button>
            </div>
            <Card>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                  Areas of Expertise
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {user.expertise?.length > 0 ? (
                    user.expertise.map((exp: any, index: number) => (
                      <Badge key={index} variant="primary" className="flex items-center gap-1">
                        {exp.subject} ({exp.proficiency})
                        {isEditingSkills && (
                          <button
                            type="button"
                            onClick={() => handleRemoveExpertise(index)}
                            className="ml-1 hover:text-blue-200 transition-colors"
                            aria-label={`Remove ${exp.subject}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-neutral-500 italic">No expertise areas listed.</span>
                  )}
                </div>
                {isEditingSkills && (
                  <div className="flex gap-2 items-center mt-2">
                    <Input 
                      placeholder="Subject" 
                      value={newExpertiseSubject} 
                      onChange={(e) => setNewExpertiseSubject(e.target.value)} 
                    />
                    <select 
                      value={newExpertiseProficiency}
                      onChange={(e) => setNewExpertiseProficiency(e.target.value)}
                      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-800 dark:bg-neutral-950 dark:text-white"
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                    <Button type="button" variant="primary" size="sm" onClick={handleAddExpertise}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="mb-2">
                <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                  Skills
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {user.skillTags?.length > 0 ? (
                    user.skillTags.map((tag: string) => (
                      <Badge key={tag} variant="default" className="flex items-center gap-1">
                        {tag}
                        {isEditingSkills && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(tag)}
                            className="ml-1 hover:text-neutral-500 transition-colors"
                            aria-label={`Remove ${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-neutral-500 italic">No skills listed.</span>
                  )}
                </div>
                {isEditingSkills && (
                  <div className="flex gap-2 items-center mt-2">
                    <Input 
                      placeholder="Add a skill" 
                      value={newSkill} 
                      onChange={(e) => setNewSkill(e.target.value)} 
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                    />
                    <Button type="button" variant="primary" size="sm" onClick={handleAddSkill}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Availability */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
              Availability
            </h3>
            <Card>
              <div className="space-y-4">
                <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                  Your Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "online", label: "Online", icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500" },
                    { value: "busy", label: "Busy", icon: Clock, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500" },
                    { value: "in_session", label: "In Session", icon: Video, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500" },
                    { value: "offline", label: "Offline", icon: Moon, color: "text-neutral-500", bg: "bg-neutral-500/10", border: "border-neutral-500" },
                  ].map((status) => {
                    const Icon = status.icon;
                    const isSelected = formData.availabilityStatus === status.value;
                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={async () => {
                          const previousStatus = formData.availabilityStatus;
                          setFormData({ ...formData, availabilityStatus: status.value });
                          try {
                            const res = await apiClient.put("/api/users/me", { availabilityStatus: status.value });
                            setUser(res.data.user);
                            setError("");
                            setMessage("Availability updated.");
                          } catch (err) {
                            setFormData({ ...formData, availabilityStatus: previousStatus });
                            setMessage("");
                            setError("Failed to update availability.");
                          }
                        }}
                        className={`flex items-center gap-2 rounded-lg border p-3 transition-all ${
                          isSelected 
                            ? `${status.border} ${status.bg} dark:${status.bg}` 
                            : "border-neutral-200 bg-white hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${isSelected ? status.color : "text-neutral-400"}`} />
                        <span className={`text-sm font-medium ${isSelected ? "text-neutral-900 dark:text-white" : "text-neutral-600 dark:text-neutral-400"}`}>
                          {status.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Right Column - Quick Info */}
        <div className="space-y-6">
          {/* Stats */}
          {/* Gamification & Badges */}
          <Card className="overflow-hidden">
            <div className="mb-6 flex items-center justify-between">
              <h4 className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-amber-500" />
                Reputation & Awards
              </h4>
              <Badge variant="primary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Level {Math.floor((user.points || 0) / 100) + 1}
              </Badge>
            </div>

            {/* Progress Bar to next level */}
            <div className="mb-8">
              <div className="mb-2 flex justify-between text-xs">
                <span className="text-neutral-500">Next Level Progress</span>
                <span className="font-bold text-neutral-900 dark:text-white">{(user.points || 0) % 100}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000"
                  style={{ width: `${(user.points || 0) % 100}%` }}
                />
              </div>
            </div>

            {/* Badges Grid */}
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Earned Badges ({user.badges?.length || 0})
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
                {user.badges && user.badges.length > 0 ? (
                  user.badges.map((badgeName: string) => {
                    const config = {
                      "First Blood": { icon: Zap, color: "from-rose-500 to-orange-500", desc: "First answer" },
                      "Reliable": { icon: CheckCircle2, color: "from-emerald-500 to-teal-600", desc: "10+ solutions" },
                      "Top Expert": { icon: Star, color: "from-amber-400 to-yellow-600", desc: "Top 10 rank" },
                      "AI Beater": { icon: Bot, color: "from-purple-600 to-indigo-600", desc: "Outsmarted AI" },
                      "Speed Demon": { icon: Clock, color: "from-cyan-500 to-blue-600", desc: "Instant solution" },
                    }[badgeName] || { icon: Award, color: "from-neutral-500 to-neutral-700", desc: "Special achievement" };

                    const Icon = config.icon;
                    const badgeCount = user.badgeCounts?.[badgeName] || 1;
                    const badgeLabel = badgeCount > 1 ? `${badgeName} x${badgeCount}` : badgeName;

                    return (
                      <div 
                        key={badgeName}
                        className="group relative flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 p-3 transition-all hover:border-amber-200 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/50 dark:hover:border-amber-900/50"
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${config.color} text-white shadow-lg`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-neutral-900 dark:text-white">{badgeLabel}</p>
                          <p className="truncate text-[10px] text-neutral-500">{config.desc}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-center dark:border-neutral-800">
                    <p className="text-xs text-neutral-500 italic">No badges earned yet. Solve threads to unlock!</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 border-t border-neutral-200 pt-6 dark:border-neutral-800">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Certificates ({user.certificates?.length || 0})
              </p>
              <div className="space-y-3">
                {user.certificates && user.certificates.length > 0 ? (
                  user.certificates.map((certificate: any) => (
                    <div
                      key={certificate.certificateId}
                      className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-neutral-900 dark:text-white">
                            {certificate.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">
                            {certificate.description}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                            <span className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                              {certificate.milestone}
                            </span>
                            <span className="rounded bg-white px-2 py-1 dark:bg-neutral-900">
                              Issued {new Date(certificate.issuedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-center dark:border-neutral-800">
                    <p className="text-xs text-neutral-500 italic">
                      No certificates earned yet. Reach milestones like 100 solutions or Fast Responder to unlock one.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <h4 className="mb-4 font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-500" />
              Your Activity
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Total Points</span>
                <span className="font-bold text-neutral-900 dark:text-white">{user.points?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Badges Collected</span>
                <span className="font-bold text-neutral-900 dark:text-white">{user.badges?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Certificates Earned</span>
                <span className="font-bold text-neutral-900 dark:text-white">{user.certificates?.length || 0}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <span className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">Global Rank</span>
                <span className="font-bold text-primary-600 dark:text-primary-400">
                  {user.rank ? `#${user.rank}` : "Unranked"}
                </span>
              </div>
            </div>
          </Card>

          {/* Connected Services */}
          <Card>
            <h4 className="mb-4 font-semibold text-neutral-900 dark:text-white">
              Connected Services
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Google Meet</span>
                <Badge variant="success">Connected</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
