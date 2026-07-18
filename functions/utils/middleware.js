function internalErrorResponse() {
  return new Response(JSON.stringify({
    error: "Internal server error",
    code: "internal_error",
  }), {
    status: 500,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function errorHandling(context) {
  try {
    return await context.next();
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error("Unhandled request error:", errorName);
    return internalErrorResponse();
  }
}
