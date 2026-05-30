describe("Public Mekari experience", () => {
  beforeEach(() => {
    cy.intercept("GET", "/api/matching/public/landing-preview", {
      fixture: "landingPreview.json",
    }).as("landingPreview");
  });

  it("renders the landing page with live collaboration preview data", () => {
    cy.visit("/");
    cy.wait("@landingPreview");

    cy.contains("Mekari").should("be.visible");
    cy.contains("Ask.").should("be.visible");
    cy.contains("MongoDB aggregation is slow on dashboard analytics").should("be.visible");
    cy.contains("Edom Mulugeta - Databases").should("be.visible");
    cy.contains("12").should("be.visible");
    cy.contains("Get Started Free").should("have.attr", "href", "/register");
    cy.contains("Browse Threads").should("have.attr", "href", "/threads");
  });

  it("lists and filters public discussion threads", () => {
    cy.intercept("GET", "/api/threads/public", {
      fixture: "publicThreads.json",
    }).as("publicThreads");

    cy.visit("/threads");
    cy.wait("@publicThreads");
    cy.contains("How do I index MongoDB messages for fast search?").should("be.visible");
    cy.contains("Best way to start a shared whiteboard session?").should("be.visible");

    cy.get('input[placeholder="Search by title, subject, author, or tag"]').type("whiteboard");
    cy.contains("Best way to start a shared whiteboard session?").should("be.visible");
    cy.contains("How do I index MongoDB messages for fast search?").should("not.exist");
    cy.contains("1 shown").should("be.visible");
  });

  it("shows a friendly empty state when no public threads exist", () => {
    cy.intercept("GET", "/api/threads/public", {
      statusCode: 200,
      body: { threads: [] },
    }).as("publicThreads");

    cy.visit("/threads");
    cy.wait("@publicThreads");
    cy.contains("No public threads yet.").should("be.visible");
    cy.contains("0 shown").should("be.visible");
  });
});
