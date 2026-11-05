#!/bin/sh
# Writes the server addresses (from docker-compose) into env.js, then starts nginx.
#   DASHBOARD_API_BASE   e.g. https://api.twth.lamarpro.com
#   DASHBOARD_CHAT_BASE  e.g. https://chat.twth.lamarpro.com
API="${DASHBOARD_API_BASE%/}"
CHAT="${DASHBOARD_CHAT_BASE%/}"
cat <<JS > /usr/share/nginx/html/env.js
window.__env = {
  apiBase: "$API/api",
  chatApiBase: "$CHAT/api",
  hubUrl: "$CHAT/api/chat/chatHub",
  chatMediaBase: "$CHAT",
  uploadsBase: "$API"
};
JS
exec nginx -g "daemon off;"
