"use client";

import { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Input } from "../../../components/ui/Input";
import { Edit, Lock, Globe, Bell, Save, X, Plus, CheckCircle2, Clock, Moon, Video } from "lucide-react";

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
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

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
          <Card>
            <h4 className="mb-4 font-semibold text-neutral-900 dark:text-white">
              Your Activity
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Threads Started</span>
                <span className="font-bold text-neutral-900 dark:text-white">24</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Replies Given</span>
                <span className="font-bold text-neutral-900 dark:text-white">156</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Consultations</span>
                <span className="font-bold text-neutral-900 dark:text-white">12</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-neutral-200 dark:border-neutral-700">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Reputation</span>
                <span className="font-bold text-primary-600 dark:text-primary-400">2.5K pts</span>
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Calendar</span>
                <Badge variant="default">Not connected</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
