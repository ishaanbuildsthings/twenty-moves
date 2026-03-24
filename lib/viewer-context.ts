export type AuthUserContext = {
  type: "auth";
  userId: string;
};

// Union type — add more context types here as needed
export type ViewerContext = AuthUserContext;
