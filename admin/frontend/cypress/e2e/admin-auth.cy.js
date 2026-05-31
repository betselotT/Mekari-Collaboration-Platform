describe("Admin authentication", () => {
  it("redirects protected pages to login without a session cookie", () => {
    cy.clearCookie("mekari_admin_session");
    cy.visit("/");
    cy.location("pathname").should("eq", "/login");
    cy.contains("Mekari Admin").should("be.visible");
  });

  it("shows invalid credential errors", () => {
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 401,
      body: { error: { message: "Invalid admin credential" } },
    }).as("adminLogin");

    cy.visit("/login");
    cy.contains("span", /^Username$/).parent("label").find("input").type("admin");
    cy.contains("span", /^Password$/).parent("label").find("input").type("wrong-password");
    cy.contains("button", "Open dashboard").click();

    cy.wait("@adminLogin").its("request.body").should("deep.eq", {
      username: "admin",
      password: "wrong-password",
    });
    cy.contains("Invalid admin credential").should("be.visible");
  });
});
