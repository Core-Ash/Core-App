import { proxyServiceRequest } from "../server/service-proxy";

export default {
  fetch(request: Request) {
    return proxyServiceRequest(request, process.env);
  },
};
