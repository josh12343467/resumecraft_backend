/*
  Warnings:

  - You are about to drop the column `full_name` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PersonalDetails" ADD COLUMN     "full_name" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "full_name";
