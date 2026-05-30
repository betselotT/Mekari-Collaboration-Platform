Cypress.Commands.add("setAdminSession", () => {
  cy.setCookie("mekari_admin_session", "mekari-admin-seeded-session");
});

Cypress.Commands.add("mockAdminDashboard", () => {
  cy.fixture("dashboard").then((data) => {
    cy.intercept("GET", "/api/admin/summary", {
      statusCode: 200,
      body: { summary: data.summary },
    }).as("adminSummary");
    cy.intercept("GET", "/api/admin/mentor-verifications*", {
      statusCode: 200,
      body: { verifications: data.verifications, pagination: data.pagination },
    }).as("mentorVerifications");
    cy.intercept("GET", "/api/admin/users?role=mentor*", {
      statusCode: 200,
      body: { users: data.mentors, pagination: data.pagination },
    }).as("mentorUsers");
    cy.intercept("GET", "/api/admin/users?role=learner*", {
      statusCode: 200,
      body: { users: data.learners, pagination: data.pagination },
    }).as("learnerUsers");
    cy.intercept("GET", "/api/admin/reports*", {
      statusCode: 200,
      body: { reports: data.reports, pagination: data.pagination },
    }).as("adminReports");
    cy.intercept("GET", "/api/admin/reported-users", {
      statusCode: 200,
      body: { reportedUsers: data.reportedUsers },
    }).as("reportedUsers");
    cy.intercept("GET", "/api/admin/action-logs*", {
      statusCode: 200,
      body: { logs: data.logs, actionTypes: ["mentor_verification"], pagination: data.pagination },
    }).as("actionLogs");
    cy.intercept("GET", "/api/admin/notifications", {
      statusCode: 200,
      body: { notifications: data.notifications },
    }).as("adminNotifications");
  });
});
