describe("Authenticated learner dashboard", () => {
  beforeEach(() => {
    cy.mockCurrentUser();
    cy.intercept("GET", "/api/threads", { fixture: "dashboardThreads.json" }).as("threads");
  });

  it("loads protected threads and filters by status", () => {
    cy.visitAsUser("/dashboard/threads");
    cy.wait("@getCurrentUser");
    cy.wait("@threads");

    cy.contains("Threads").should("be.visible");
    cy.contains("Socket.io messages arrive twice after reconnect").should("be.visible");
    cy.contains("Gemini tag suggestions for database questions").should("be.visible");

    cy.contains("button", "AI Resolved").click();
    cy.contains("Gemini tag suggestions for database questions").should("be.visible");
    cy.contains("Socket.io messages arrive twice after reconnect").should("not.exist");
  });

  it("creates a thread and sends suggested tags to the API", () => {
    cy.intercept("POST", "/api/threads", {
      statusCode: 201,
      body: {
        thread: {
          _id: "created-thread-1",
          title: "Need help debugging Socket.io reconnects",
          subject: "Software Engineering",
        },
        suggestedExperts: [
          {
            score: 91,
            reasons: ["Strong realtime expertise"],
            expert: {
              _id: "expert-1",
              name: "Edom Mulugeta",
              expertise: [{ subject: "Software Engineering", proficiency: "expert" }],
              availabilityStatus: "online",
            },
          },
        ],
      },
    }).as("createThread");
    cy.intercept("GET", "/api/threads/created-thread-1*", {
      statusCode: 200,
      body: {
        thread: { _id: "created-thread-1", title: "Need help debugging Socket.io reconnects" },
        messages: [],
      },
    });

    cy.visitAsUser("/dashboard/threads");
    cy.wait("@threads");
    cy.contains("button", "New Thread").click();
    cy.contains("Title").parent().find("input").type("Need help debugging Socket.io reconnects");
    cy.contains("Subject").parent().find("input").type("Software Engineering");
    cy.contains("Your tags").parent().find("input").type("socket.io, reconnect, listeners");
    cy.contains("Initial message")
      .parent()
      .find("textarea")
      .type("After reconnecting, every chat message appears twice. What should I check?");
    cy.contains("button", "Create thread").click();

    cy.wait("@createThread").its("request.body").should((body) => {
      expect(body.title).to.eq("Need help debugging Socket.io reconnects");
      expect(body.subject).to.eq("Software Engineering");
      expect(body.tags).to.deep.eq(["socket.io", "reconnect", "listeners"]);
      expect(body.initialMessage).to.include("appears twice");
    });
    cy.location("pathname").should("eq", "/dashboard/threads/created-thread-1");
  });

  it("uses the AI assistant, renders the answer, and persists chat history", () => {
    cy.intercept("POST", "/api/ai/chat", {
      statusCode: 200,
      body: {
        message: {
          body: "Check duplicate event listeners and clean them up with `socket.off()` before reconnecting.",
          createdAt: "2026-05-30T08:00:00.000Z",
          isFromAi: true,
        },
        model: "gemini-test",
      },
    }).as("aiChat");

    cy.visitAsUser("/dashboard/ai-assistant");
    cy.wait("@getCurrentUser");
    cy.contains("Engineering concept assistant").should("be.visible");
    cy.get('input[placeholder="Ask an engineering question..."]').type("Why are messages duplicated?");
    cy.get('button[type="submit"]').click();

    cy.wait("@aiChat").its("request.body.prompt").should("eq", "Why are messages duplicated?");
    cy.contains("Why are messages duplicated?").should("be.visible");
    cy.contains("Check duplicate event listeners").should("be.visible");
    cy.window()
      .its("localStorage.mekari_ai_chat_history")
      .should("include", "Why are messages duplicated?");
  });
});
