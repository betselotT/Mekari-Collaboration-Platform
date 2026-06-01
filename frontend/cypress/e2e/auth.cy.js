describe("Mekari authentication", () => {
  it("shows login errors and links unverified users to email verification", () => {
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 403,
      body: { message: "Please verify your email before signing in" },
    }).as("loginRequest");

    cy.visitVerified("/login");
    cy.contains("Email").parent().find("input").type("learner@example.com");
    cy.contains("Password").parent().find("input").type("WrongPass123!");
    cy.contains("button", "Sign in").click();

    cy.wait("@loginRequest").its("request.body").should("deep.include", {
      email: "learner@example.com",
      password: "WrongPass123!",
    });
    cy.contains("Please verify your email before signing in").should("be.visible");
    cy.contains("a", "Verify your email")
      .should("have.attr", "href")
      .and("include", "/verify-email?email=learner%40example.com");
  });

  it("stores the token and redirects to the dashboard on successful login", () => {
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 200,
      body: { token: "login-token" },
    }).as("loginRequest");

    cy.visitVerified("/login");
    cy.contains("Email").parent().find("input").type("learner@example.com");
    cy.contains("Password").parent().find("input").type("StrongPass123!");
    cy.contains("button", "Sign in").click();

    cy.wait("@loginRequest");
    cy.location("pathname").should("include", "/dashboard");
    cy.window().its("localStorage.mekari_token").should("eq", "login-token");
  });

  it("shows the stored ban reason when a banned user tries to sign in", () => {
    cy.intercept("POST", "/api/auth/login", {
      statusCode: 403,
      body: { error: { message: "Your account has been banned. Reason: Repeated harassment after warnings" } },
    }).as("bannedLogin");

    cy.visitVerified("/login");
    cy.contains("Email").parent().find("input").type("banned@example.com");
    cy.contains("Password").parent().find("input").type("StrongPass123!");
    cy.contains("button", "Sign in").click();

    cy.wait("@bannedLogin");
    cy.contains("Your account has been banned. Reason: Repeated harassment after warnings").should("be.visible");
  });

  it("validates registration locally before calling the API", () => {
    cy.visitVerified("/register");
    cy.contains("span", /^Full name$/).parent("label").find("input").type("R1");
    cy.contains("span", /^Email$/).parent("label").find("input").type("new@example.com");
    cy.contains("span", /^Password$/).parent("label").find("input").type("weak");
    cy.contains("button", "Create learner account").click();

    cy.contains("Full name must contain letters and spaces only.").should("be.visible");
  });

  it("submits learner registration and redirects to verification", () => {
    cy.intercept("POST", "/api/auth/register", {
      statusCode: 201,
      body: { message: "Registered" },
    }).as("registerRequest");

    cy.visitVerified("/register");
    cy.contains("span", /^Full name$/).parent("label").find("input").type("New Learner");
    cy.contains("span", /^Email$/).parent("label").find("input").type("new@example.com");
    cy.contains("span", /^Password$/).parent("label").find("input").type("StrongPass123!");
    cy.contains("span", /^Primary technical field$/).parent("label").find("input").type("Software Engineering");
    cy.contains("How do you want to use Mekari?")
      .parent()
      .find("textarea")
      .type("Quick questions and mentorship.");
    cy.contains("I have read and agree to follow the community guidelines.")
      .parent()
      .find("input")
      .check();
    cy.contains("button", "Create learner account").click();

    cy.wait("@registerRequest").its("request.body").should("deep.include", {
      name: "New Learner",
      email: "new@example.com",
      accountType: "learner",
      primaryTechnicalField: "Software Engineering",
      communityGuidelinesAccepted: true,
    });
    cy.location("pathname").should("eq", "/verify-email");
    cy.location("search").should("include", "email=new%40example.com");
  });

  it("requires community guidelines acceptance before registration", () => {
    cy.intercept("POST", "/api/auth/register").as("registerRequest");

    cy.visitVerified("/register");
    cy.contains("Community guidelines").should("be.visible");
    cy.window().then((win) => {
      cy.stub(win.Element.prototype, "scrollIntoView").as("scrollToError");
    });
    cy.get('button[aria-label="Continue with Google"]').click();
    cy.contains("You must accept the community guidelines before registering.").should("be.visible");
    cy.get("@scrollToError").should("have.been.called");
    cy.contains("span", /^Full name$/).parent("label").find("input").type("New Learner");
    cy.contains("span", /^Email$/).parent("label").find("input").type("new@example.com");
    cy.contains("span", /^Password$/).parent("label").find("input").type("StrongPass123!");
    cy.contains("button", "Create learner account").click();

    cy.contains("You must accept the community guidelines before registering.").should("be.visible");
    cy.get("@registerRequest.all").should("have.length", 0);
  });
});
