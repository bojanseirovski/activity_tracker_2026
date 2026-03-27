"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToS3 = uploadToS3;
exports.deleteFromS3 = deleteFromS3;
const client_s3_1 = require("@aws-sdk/client-s3");
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || '';
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || '';
const s3 = new client_s3_1.S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
});
function uploadToS3(key, body, contentType) {
    return __awaiter(this, void 0, void 0, function* () {
        yield s3.send(new client_s3_1.PutObjectCommand({
            Bucket: AWS_S3_BUCKET,
            Key: key,
            Body: body,
            ContentType: contentType,
        }));
        return `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    });
}
function deleteFromS3(key) {
    return __awaiter(this, void 0, void 0, function* () {
        yield s3.send(new client_s3_1.DeleteObjectCommand({
            Bucket: AWS_S3_BUCKET,
            Key: key,
        }));
    });
}
