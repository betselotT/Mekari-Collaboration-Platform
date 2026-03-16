"use client";

import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Avatar } from "../../../components/ui/Avatar";
import { Badge } from "../../../components/ui/Badge";
import { Edit, Lock, Globe, Bell } from "lucide-react";

export default function ProfilePage() {
  return (
    <DashboardLayout title="Profile">
      {/* Edit Profile Button */}
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Profile</h2>
        <Button variant="primary" size="md">
          <Edit className="h-4 w-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      {/* Profile Header */}
      <Card className="mb-8">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Avatar size="xl" initials="AM" />
          <div className="flex-1">
            <h3 className="mb-1 text-2xl font-bold text-neutral-900 dark:text-white">
              Alex Mekari
            </h3>
            <p className="mb-4 text-neutral-600 dark:text-neutral-400">
              alex.mekari@enterprise.com
            </p>
            <p className="mb-6 max-w-2xl text-neutral-600 dark:text-neutral-400">
              Leading cross-functional teams to deliver AI-driven enterprise solutions. Passionate about productivity, automation, and building scalable system architectures that solve real-world business challenges.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary">AI Strategy</Badge>
              <Badge variant="primary">Availability: Remote</Badge>
              <Badge variant="success">Google Meet Connected</Badge>
            </div>
          </div>
        </div>

        {/* Note Section */}
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
          <div className="flex gap-3">
            <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Note: Edit expertise, availability, and connect Google for Meet links in the account settings tab.
            </p>
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
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary-100 p-2 dark:bg-primary-900">
                      <Lock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900 dark:text-white">
                        Two-Factor Auth
                      </h4>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">
                        Not enabled
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Manage
                  </Button>
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
                  <Button variant="ghost" size="sm">
                    Change
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Expertise & Skills */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
              Expertise & Skills
            </h3>
            <Card>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                  Areas of Expertise
                </label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary">Software Architecture</Badge>
                  <Badge variant="primary">AI/ML Systems</Badge>
                  <Badge variant="primary">Cloud Infrastructure</Badge>
                </div>
              </div>
              <Button variant="secondary" size="sm">
                Add More Skills
              </Button>
            </Card>
          </div>

          {/* Availability */}
          <div>
            <h3 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
              Availability
            </h3>
            <Card>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                    Your Status
                  </label>
                  <select className="input">
                    <option>Available for consultations</option>
                    <option>Limited availability</option>
                    <option>Not available</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 dark:text-white mb-2">
                    Hours
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Mon-Fri 9AM-5PM PST"
                    className="input"
                  />
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
