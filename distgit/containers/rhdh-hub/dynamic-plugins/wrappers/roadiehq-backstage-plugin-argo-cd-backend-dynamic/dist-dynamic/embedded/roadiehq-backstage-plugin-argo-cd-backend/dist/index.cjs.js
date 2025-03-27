'use strict';

var router = require('./service/router.cjs.js');
var argocdService_ref = require('./refs/argocdService.ref.cjs.js');
var argocd_service = require('./service/argocd.service.cjs.js');



exports.createRouter = router.createRouter;
exports.argocdServiceRef = argocdService_ref.argocdServiceRef;
exports.ArgoService = argocd_service.ArgoService;
//# sourceMappingURL=index.cjs.js.map
