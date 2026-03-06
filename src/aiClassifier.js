function classifyTicket(text) {
  const source = String(text || "").toLowerCase();

  if (source.includes("결제") || source.includes("payment") || source.includes("refund")) {
    return "billing";
  }
  if (source.includes("로그인") || source.includes("login") || source.includes("비밀번호")) {
    return "auth";
  }
  if (source.includes("오류") || source.includes("error") || source.includes("bug")) {
    return "bug";
  }

  return "general";
}

module.exports = { classifyTicket };
