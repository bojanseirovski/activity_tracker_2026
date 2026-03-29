import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const A_S3_BUCKET = process.env.A_S3_BUCKET || '';
const A_REGION = process.env.A_REGION || 'us-east-1';

const A_ACCESS_KEY_ID = process.env.A_ACCESS_KEY_ID || '';
const A_SECRET_ACCESS_KEY = process.env.A_SECRET_ACCESS_KEY || '';


const s3 = new S3Client({
    region: A_REGION,
    credentials: {
        accessKeyId: A_ACCESS_KEY_ID!,
        secretAccessKey: A_SECRET_ACCESS_KEY!,
    },
});

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
    await s3.send(new PutObjectCommand({
        Bucket: A_S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
    }));
    return `https://${A_S3_BUCKET}.s3.${A_REGION}.amazonaws.com/${key}`;
}

export async function deleteFromS3(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
        Bucket: A_S3_BUCKET,
        Key: key,
    }));
}
