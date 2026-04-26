import swaggerJSDoc from "swagger-jsdoc";

export function createOpenApiSpec() {
  const port = process.env.PORT || 4000;
  const serverUrl = process.env.PUBLIC_API_BASE_URL || `http://localhost:${port}`;

  return swaggerJSDoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "MEKARI Backend API",
        version: "1.0.0",
      },
      servers: [{ url: serverUrl }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
      paths: {
        "/health": {
          get: {
            tags: ["System"],
            summary: "Health check",
            security: [],
            responses: {
              "200": {
                description: "OK",
              },
            },
          },
        },
        "/api/auth/register": {
          post: {
            tags: ["Auth"],
            summary: "Register a user",
            security: [],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["name", "email", "password"],
                    properties: {
                      name: { type: "string", minLength: 2 },
                      email: { type: "string", format: "email" },
                      password: { type: "string", minLength: 6 },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Registered" },
              "409": { description: "Email already in use" },
            },
          },
        },
        "/api/auth/login": {
          post: {
            tags: ["Auth"],
            summary: "Login",
            security: [],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                      email: { type: "string", format: "email" },
                      password: { type: "string", minLength: 6 },
                    },
                  },
                },
              },
            },
            responses: {
              "200": { description: "Logged in" },
              "401": { description: "Invalid credentials" },
            },
          },
        },
        "/api/users/me": {
          get: {
            tags: ["Users"],
            summary: "Get current user profile",
            responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
          },
          put: {
            tags: ["Users"],
            summary: "Update current user profile",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
            responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
          },
        },
        "/api/users/experts": {
          get: {
            tags: ["Users"],
            summary: "List users with expertise",
            responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
          },
        },
        "/api/threads": {
          get: {
            tags: ["Threads"],
            summary: "List threads",
            parameters: [
              {
                name: "subject",
                in: "query",
                required: false,
                schema: { type: "string" },
              },
            ],
            responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
          },
          post: {
            tags: ["Threads"],
            summary: "Create a thread",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["title", "subject", "initialMessage"],
                    properties: {
                      title: { type: "string", minLength: 5 },
                      subject: { type: "string", minLength: 1 },
                      initialMessage: { type: "string", minLength: 1 },
                    },
                  },
                },
              },
            },
            responses: { "201": { description: "Created" }, "401": { description: "Unauthorized" } },
          },
        },
        "/api/threads/{threadId}/messages": {
          get: {
            tags: ["Threads"],
            summary: "Get thread messages",
            parameters: [
              { name: "threadId", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
          },
          post: {
            tags: ["Threads"],
            summary: "Send a message to a thread",
            parameters: [
              { name: "threadId", in: "path", required: true, schema: { type: "string" } },
            ],
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["body"],
                    properties: { body: { type: "string", minLength: 1 } },
                  },
                },
              },
            },
            responses: { "201": { description: "Created" }, "401": { description: "Unauthorized" } },
          },
        },
        "/api/matching/request": {
          post: {
            tags: ["Matching"],
            summary: "Create a match request (creates a thread + computes recommendations)",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["title", "subject", "initialMessage"],
                    properties: {
                      title: { type: "string", minLength: 5 },
                      subject: { type: "string", minLength: 1 },
                      initialMessage: { type: "string", minLength: 1 },
                      tags: { type: "array", items: { type: "string" } },
                      availabilityPreference: {
                        type: "string",
                        enum: ["online_only", "online_or_busy", "any"],
                      },
                      questionnaire: { type: "object", additionalProperties: true },
                    },
                  },
                },
              },
            },
            responses: { "201": { description: "Created" }, "401": { description: "Unauthorized" } },
          },
        },
        "/api/matching/requests/{matchRequestId}": {
          get: {
            tags: ["Matching"],
            summary: "Get a match request",
            parameters: [
              {
                name: "matchRequestId",
                in: "path",
                required: true,
                schema: { type: "string" },
              },
            ],
            responses: {
              "200": { description: "OK" },
              "401": { description: "Unauthorized" },
              "403": { description: "Forbidden" },
              "404": { description: "Not found" },
            },
          },
        },
        "/api/analytics/overview": {
          get: {
            tags: ["Analytics"],
            summary: "Get overview metrics",
            responses: { "200": { description: "OK" }, "401": { description: "Unauthorized" } },
          },
        },
        "/api/ai/chat": {
          post: {
            tags: ["AI"],
            summary: "Chat (placeholder AI response)",
            requestBody: {
              required: true,
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["threadId", "prompt"],
                    properties: {
                      threadId: { type: "string" },
                      prompt: { type: "string", minLength: 5 },
                    },
                  },
                },
              },
            },
            responses: { "201": { description: "Created" }, "401": { description: "Unauthorized" } },
          },
        },
      },
    },
    // We keep apis empty for now (no JSDoc annotations required).
    apis: [],
  });
}

