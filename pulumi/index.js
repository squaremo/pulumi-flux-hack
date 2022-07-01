"use strict";
const pulumi = require("@pulumi/pulumi");
const k8s = require("@pulumi/kubernetes");

const config = new pulumi.Config();
const ns = config.require('namespace');

const appLabels = { app: "podinfo" };

const deployment = new k8s.apps.v1.Deployment("podinfo", {
    metadata: {
        namespace: ns,
    },
    spec: {
        selector: { matchLabels: appLabels },
        replicas: 1,
        template: {
            metadata: { labels: appLabels },
            spec: { containers: [{ name: "podinfo", image: "ghcr.io/stefanprodan/podinfo:6.1.6" }] }
        }
    }
});

const service = new k8s.core.v1.Service("podinfo", {
    metadata: {
        namespace: ns,
    },
    spec: {
        selector: appLabels,
        ports: [
            {port: 80, targetPort: 9898},
        ],
    }
});

// From https://kubernetes.github.io/ingress-nginx/examples/customization/configuration-snippets/#ingress

// apiVersion: networking.k8s.io/v1
// kind: Ingress
// metadata:
//   name: nginx-configuration-snippet
//   annotations:
//     nginx.ingress.kubernetes.io/configuration-snippet: |
//       more_set_headers "Request-Id: $req_id";
// spec:
//   ingressClassName: nginx
//   rules:
//   - host: custom.configuration.com
//     http:
//       paths:
//       - path: /
//         pathType: Prefix
//         backend:
//           service:
//             name: http-svc
//             port:
//               number: 80
//
// The 'rewrite' annotation comes from
// https://github.com/kubernetes/ingress-nginx/blob/main/docs/examples/rewrite/README.md.

const ingress = new k8s.networking.v1.Ingress('podinfo', {
    metadata: {
        namespace: ns,
        annotations: {
            'nginx.ingress.kubernetes.io/rewrite-target': '/$2'
        }
    },
    spec: {
        ingressClassName: 'nginx',
        rules: [{
            host: 'localhost',
            http: {
                paths: [{
                    path: `/${ns}(/|$)(.*)`,
                    pathType: 'Prefix',
                    backend: {
                        service: {
                            name: service.metadata.name,
                            port: { number: 80 },
                        },
                    },
                }],
            },
        }],
    },
});

exports.name = deployment.metadata.name;
exports.url = ingress.status.apply(_ => {
    return `http://localhost/${ns}/`;
});
