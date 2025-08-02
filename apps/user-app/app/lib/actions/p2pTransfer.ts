"use server"
import { getServerSession } from "next-auth";
import { authOptions } from "../auth";
import prisma from "@repo/db/client";

export async function p2pTransfer(to: string, amount: number) {
    const session = await getServerSession(authOptions);
    const from = session?.user?.id;
    if (!from) {
        return {
            message: "Error while sending"
        }
    }

    // console.log("to:", to, typeof to);
    const toUser = await prisma.user.findFirst({
        where: {
            number: to
        }
    });

    // console.log("toUser:", toUser);

    

    if (!toUser) {
        return {
            message: "User not found"
        }
    }
    await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT * FROM "Balance" WHERE "userId" = ${Number(from)} FOR UPDATE`
        const fromBalance = await tx.balance.findUnique({
            where: { userId: Number(from) },
          });
          if (!fromBalance || fromBalance.amount < amount) {
            throw new Error('Insufficient funds');
          }
          const amountInPaise = amount * 100;
          await tx.balance.update({
            where: { userId: Number(from) },
            data: { amount: { decrement: amountInPaise } },
          });

          await tx.balance.update({
            where: { userId: toUser.id },
            data: { amount: { increment: amountInPaise } },
          });

          await tx.p2PTransfer.create({
            data:{
                fromUserId:Number(from),
                toUserId: toUser.id,
                amount,
                timestamp:new Date()
            }
          })
    });
}