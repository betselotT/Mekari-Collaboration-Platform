describe("Profile management", () => {
  beforeEach(() => {
    cy.mockCurrentUser();
  });

  it("edits basic profile details and availability", () => {
    cy.fixture("currentUser").then((currentUser) => {
      const updated = {
        ...currentUser,
        user: {
          ...currentUser.user,
          name: "Rafia Updated",
          bio: "I mentor peers on React and MongoDB.",
          availabilityStatus: "busy",
        },
      };

      cy.intercept("PUT", "/api/users/me", { statusCode: 200, body: updated }).as("updateUser");
    });

    cy.visitAsUser("/dashboard/profile");
    cy.wait("@getCurrentUser");
    cy.contains("Rafia Kedir").should("be.visible");
    cy.contains("button", "Edit Profile").click();
    cy.contains("Full Name").parent().find("input").clear().type("Rafia Updated");
    cy.contains("Bio").parent().find("textarea").clear().type("I mentor peers on React and MongoDB.");
    cy.contains("button", "Save").click();

    cy.wait("@updateUser").its("request.body").should("deep.include", {
      name: "Rafia Updated",
      bio: "I mentor peers on React and MongoDB.",
    });
    cy.contains("Profile updated.").should("be.visible");
    cy.contains("Rafia Updated").should("be.visible");
  });
});
