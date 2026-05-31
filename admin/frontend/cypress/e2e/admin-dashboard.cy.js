describe("Admin moderation dashboard", () => {
  beforeEach(() => {
    cy.setAdminSession();
    cy.mockAdminDashboard();
  });

  it("loads mentor verification, metrics, alerts, and users", () => {
    cy.visit("/");
    cy.wait(["@adminSummary", "@mentorVerifications", "@mentorUsers", "@learnerUsers"]);

    cy.contains("Pending mentor reviews").should("be.visible");
    cy.contains("Edom Mulugeta").should("be.visible");
    cy.contains("student-id.pdf").should("be.visible");
    cy.contains("button", "Alerts").click();
    cy.contains("New mentor verification request from Edom Mulugeta").should("be.visible");

    cy.contains("button", "Users").click();
    cy.contains("Mentors").should("be.visible");
    cy.contains("Rafia Kedir").should("be.visible");
  });

  it("approves mentor verification requests", () => {
    cy.intercept("PATCH", "/api/admin/mentor-verifications/mentor-1", {
      statusCode: 200,
      body: { ok: true },
    }).as("approveMentor");

    cy.visit("/");
    cy.wait("@mentorVerifications");
    cy.contains("article", "Edom Mulugeta").within(() => {
      cy.contains("button", "Approve").click();
    });

    cy.wait("@approveMentor").its("request.body").should("deep.include", {
      status: "approved",
    });
  });

  it("reviews reports and records moderation actions", () => {
    cy.intercept("PATCH", "/api/admin/reports/report-1", {
      statusCode: 200,
      body: { ok: true },
    }).as("updateReport");

    cy.visit("/");
    cy.wait("@adminReports");
    cy.contains("button", "Reports").click();
    cy.contains("Promotional spam in thread").should("be.visible");
    cy.contains("article", "Promotional spam in thread").within(() => {
      cy.contains("button", "Strike").click();
    });

    cy.wait("@updateReport").its("request.body").should("deep.eq", {
      status: "struck",
      actionTaken: "Strike issued",
    });
    cy.contains("Users With Report Strikes").should("be.visible");
    cy.contains("Reported User").should("be.visible");
  });

  it("requires a reason before banning a user on the third strike", () => {
    cy.intercept("PATCH", "/api/admin/reports/report-ban-1", {
      statusCode: 200,
      body: { banned: true, strikeCount: 3, banReason: "Repeated harassment after warnings" },
    }).as("banUser");

    cy.visit("/");
    cy.wait("@adminReports");
    cy.contains("button", "Reports").click();
    cy.contains("article", "Repeated harassment in private messages").within(() => {
      cy.contains("button", "Strike and ban").click();
    });

    cy.contains("This is the third strike. The user will be blocked from signing in immediately.").should("be.visible");
    cy.contains("button", "Ban user").should("be.disabled");
    cy.get('textarea[placeholder="Explain why this user is being banned."]')
      .type("Repeated harassment after warnings");
    cy.contains("button", "Ban user").click();

    cy.wait("@banUser").its("request.body").should("deep.include", {
      status: "struck",
      banReason: "Repeated harassment after warnings",
    });
  });

  it("shows action logs for auditability", () => {
    cy.visit("/");
    cy.wait("@actionLogs");
    cy.contains("button", "Action Log").click();

    cy.contains("Mentor verification submitted").should("be.visible");
    cy.contains("td", "mentor_verification").should("be.visible");
    cy.contains("Edom Mulugeta").should("be.visible");
  });
});
