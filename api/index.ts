import { proxyServiceRequest } from "../server/service-proxy.js";

export default {
  fetch(request: Request) {
    return proxyServiceRequest(request, process.env);
  },
};
