-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'CLINIC_OWNER', 'MANAGER', 'DOCTOR', 'ASSISTANT', 'ACCOUNTANT', 'RECEPTIONIST');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'OTHER', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "PatientTag" AS ENUM ('NEW', 'ACTIVE', 'PASSIVE', 'RISKY', 'VIP');

-- CreateEnum
CREATE TYPE "PatientFileCategory" AS ENUM ('BEFORE', 'AFTER', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING_CONFIRMATION', 'PLANNED', 'ARRIVED', 'NO_SHOW', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TreatmentStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'STARTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('DRAFT', 'SENT', 'SIGNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "CommunicationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "RecallStatus" AS ENUM ('OPEN', 'CONTACTED', 'SCHEDULED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TourismLeadSourceChannel" AS ENUM ('WEB_FORM', 'WHATSAPP', 'INSTAGRAM_DM', 'MANUAL', 'N8N_WEBHOOK', 'AIRTABLE');

-- CreateEnum
CREATE TYPE "TourismLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'WAITING_REPLY', 'QUALIFIED', 'PACKAGE_SENT', 'BOOKED', 'TREATMENT_STARTED', 'TREATMENT_COMPLETED', 'LOST');

-- CreateEnum
CREATE TYPE "TourismCurrency" AS ENUM ('EUR', 'USD', 'GBP', 'TRY');

-- CreateEnum
CREATE TYPE "TourismPackageStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ReservationShareChannel" AS ENUM ('N8N', 'EMAIL', 'WHATSAPP', 'MANUAL');

-- CreateEnum
CREATE TYPE "ReservationShareStatus" AS ENUM ('PENDING', 'SENT', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadFollowUpStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'STOPPED');

-- CreateEnum
CREATE TYPE "PostTreatmentFollowUpStatus" AS ENUM ('SCHEDULED', 'SENT', 'REPLIED', 'ISSUE_REPORTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewPlatform" AS ENUM ('GOOGLE', 'TRUSTPILOT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('SCHEDULED', 'SENT', 'CLICKED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BeforeAfterStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED_WEBSITE', 'PUBLISHED_SOCIAL', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DigitalConsentStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'SIGNED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TourismSurveySource" AS ENUM ('WHATSAPP', 'EMAIL', 'WEB_LINK');

-- CreateEnum
CREATE TYPE "ChatbotCategory" AS ENUM ('PRICE', 'DURATION', 'VISA', 'HOTEL', 'TRANSFER', 'TREATMENT', 'APPOINTMENT', 'GENERAL');

-- CreateEnum
CREATE TYPE "ChatConversationChannel" AS ENUM ('WEBSITE', 'WHATSAPP', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "ChatConversationStatus" AS ENUM ('BOT_HANDLED', 'HUMAN_NEEDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatMessageSender" AS ENUM ('BOT', 'PATIENT', 'HUMAN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAD', 'PACKAGE', 'FOLLOW_UP', 'POST_TREATMENT', 'REVIEW', 'SURVEY', 'ISSUE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('N8N', 'AIRTABLE', 'WHATSAPP', 'INSTAGRAM', 'EMAIL', 'SMS', 'GOOGLE_REVIEW', 'TRUSTPILOT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "IntegrationLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'Klinik',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" "Gender" NOT NULL DEFAULT 'UNSPECIFIED',
    "address" TEXT,
    "allergies" TEXT,
    "chronicDiseases" TEXT,
    "medications" TEXT,
    "notes" TEXT,
    "tag" "PatientTag" NOT NULL DEFAULT 'NEW',
    "lastVisitAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientFile" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" "PatientFileCategory" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "room" TEXT,
    "treatmentType" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "toothNumber" TEXT,
    "treatmentType" TEXT NOT NULL,
    "description" TEXT,
    "estimatedFee" DECIMAL(12,2) NOT NULL,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'PROPOSED',
    "plannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "toothNumber" TEXT,
    "treatmentType" TEXT NOT NULL,
    "description" TEXT,
    "fee" DECIMAL(12,2) NOT NULL,
    "paymentPlan" JSONB,
    "status" "TreatmentStatus" NOT NULL DEFAULT 'STARTED',
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "treatmentId" TEXT,
    "type" "PaymentType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "listAmount" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2),
    "referralSource" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "description" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "patientId" TEXT,
    "paymentId" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "providerRef" TEXT,
    "issuedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "currentQuantity" INTEGER NOT NULL,
    "minimumQuantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "supplier" TEXT,
    "purchasePrice" DECIMAL(12,2) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "workingHours" TEXT,
    "compensation" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "room" TEXT,
    "satisfactionScore" DECIMAL(4,2) NOT NULL,
    "weeklySchedule" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'DRAFT',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyResponse" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "packageId" TEXT,
    "surveyTemplateId" TEXT,
    "score" INTEGER NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "answersJson" JSONB,
    "npsScore" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "source" "TourismSurveySource",
    "followUpNeeded" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "channel" "CommunicationChannel" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL DEFAULT 'OUTBOUND',
    "subject" TEXT,
    "source" TEXT,
    "contactName" TEXT,
    "contactValue" TEXT,
    "message" TEXT NOT NULL,
    "status" "CommunicationStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "providerRef" TEXT,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recall" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "RecallStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "clinicSize" TEXT NOT NULL,
    "message" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "sourceChannel" "TourismLeadSourceChannel" NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "language" TEXT NOT NULL DEFAULT 'EN',
    "interestedTreatment" TEXT NOT NULL,
    "estimatedBudget" TEXT,
    "travelDate" TIMESTAMP(3),
    "message" TEXT NOT NULL,
    "leadStatus" "TourismLeadStatus" NOT NULL DEFAULT 'NEW',
    "leadScore" INTEGER NOT NULL DEFAULT 50,
    "assignedToUserId" TEXT,
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "direction" "CommunicationDirection" NOT NULL DEFAULT 'INBOUND',
    "channel" "CommunicationChannel" NOT NULL,
    "source" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TourismPackage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "leadId" TEXT NOT NULL,
    "patientId" TEXT,
    "publicToken" TEXT NOT NULL,
    "packageTitle" TEXT NOT NULL,
    "treatmentSummary" TEXT NOT NULL,
    "hotelInfo" TEXT,
    "transferInfo" TEXT,
    "arrivalAirport" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "departureDate" TIMESTAMP(3),
    "numberOfCompanions" INTEGER NOT NULL DEFAULT 0,
    "totalTreatmentPrice" DECIMAL(12,2) NOT NULL,
    "hotelPrice" DECIMAL(12,2) NOT NULL,
    "transferPrice" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "finalPrice" DECIMAL(12,2) NOT NULL,
    "currency" "TourismCurrency" NOT NULL DEFAULT 'EUR',
    "packageStatus" "TourismPackageStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TourismPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "treatmentName" TEXT NOT NULL,
    "toothArea" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "estimatedDuration" TEXT,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TreatmentPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelPartner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "address" TEXT,
    "starRating" INTEGER,
    "pricePerNight" DECIMAL(12,2) NOT NULL,
    "currency" "TourismCurrency" NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferPartner" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "vehicleTypes" JSONB NOT NULL,
    "airportList" JSONB NOT NULL,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "currency" "TourismCurrency" NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationShare" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "packageId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "hotelPartnerId" TEXT,
    "transferPartnerId" TEXT,
    "sharedVia" "ReservationShareChannel" NOT NULL DEFAULT 'N8N',
    "payloadJson" JSONB NOT NULL,
    "status" "ReservationShareStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpSequence" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "stepsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadFollowUp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "leadId" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "status" "LeadFollowUpStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostTreatmentFollowUp" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "patientId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "packageId" TEXT,
    "publicToken" TEXT NOT NULL,
    "returnCountry" TEXT NOT NULL,
    "returnDate" TIMESTAMP(3) NOT NULL,
    "followUpDay" INTEGER NOT NULL,
    "nextMessageAt" TIMESTAMP(3) NOT NULL,
    "status" "PostTreatmentFollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
    "issueReported" BOOLEAN NOT NULL DEFAULT false,
    "issueDescription" TEXT,
    "painLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostTreatmentFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "patientId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "packageId" TEXT,
    "platform" "ReviewPlatform" NOT NULL,
    "reviewLink" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'SCHEDULED',
    "language" TEXT NOT NULL DEFAULT 'EN',
    "messageTemplate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeforeAfterCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "patientId" TEXT NOT NULL,
    "treatmentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "beforeImageUrl" TEXT NOT NULL,
    "afterImageUrl" TEXT NOT NULL,
    "consentGiven" BOOLEAN NOT NULL DEFAULT false,
    "consentId" TEXT,
    "country" TEXT,
    "ageRange" TEXT,
    "gender" TEXT,
    "tags" JSONB,
    "privacyNotes" TEXT,
    "status" "BeforeAfterStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeforeAfterCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "treatmentType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "patientId" TEXT,
    "leadId" TEXT,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentSnapshot" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" "DigitalConsentStatus" NOT NULL DEFAULT 'DRAFT',
    "signedAt" TIMESTAMP(3),
    "signerName" TEXT,
    "signerIp" TEXT,
    "signerUserAgent" TEXT,
    "signatureData" TEXT,
    "sourceConsentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "questionsJson" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatbotKnowledgeBase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "category" "ChatbotCategory" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotKnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatConversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "leadId" TEXT,
    "channel" "ChatConversationChannel" NOT NULL,
    "language" TEXT NOT NULL,
    "status" "ChatConversationStatus" NOT NULL DEFAULT 'BOT_HANDLED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "ChatMessageSender" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "assignedToUserId" TEXT,
    "relatedLeadId" TEXT,
    "relatedPatientId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "provider" "IntegrationProvider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "responseJson" JSONB,
    "status" "IntegrationLogStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Branch_organizationId_idx" ON "Branch"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "User_branchId_idx" ON "User"("branchId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Patient_organizationId_idx" ON "Patient"("organizationId");

-- CreateIndex
CREATE INDEX "Patient_branchId_idx" ON "Patient"("branchId");

-- CreateIndex
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");

-- CreateIndex
CREATE INDEX "Patient_tag_idx" ON "Patient"("tag");

-- CreateIndex
CREATE INDEX "PatientFile_patientId_idx" ON "PatientFile"("patientId");

-- CreateIndex
CREATE INDEX "PatientFile_organizationId_idx" ON "PatientFile"("organizationId");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_startsAt_idx" ON "Appointment"("organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_branchId_idx" ON "Appointment"("branchId");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_organizationId_idx" ON "TreatmentPlan"("organizationId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_branchId_idx" ON "TreatmentPlan"("branchId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_patientId_idx" ON "TreatmentPlan"("patientId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_doctorId_idx" ON "TreatmentPlan"("doctorId");

-- CreateIndex
CREATE INDEX "Treatment_organizationId_idx" ON "Treatment"("organizationId");

-- CreateIndex
CREATE INDEX "Treatment_branchId_idx" ON "Treatment"("branchId");

-- CreateIndex
CREATE INDEX "Treatment_patientId_idx" ON "Treatment"("patientId");

-- CreateIndex
CREATE INDEX "Treatment_doctorId_idx" ON "Treatment"("doctorId");

-- CreateIndex
CREATE INDEX "Payment_organizationId_paidAt_idx" ON "Payment"("organizationId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_branchId_idx" ON "Payment"("branchId");

-- CreateIndex
CREATE INDEX "Payment_patientId_idx" ON "Payment"("patientId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- CreateIndex
CREATE INDEX "Invoice_branchId_idx" ON "Invoice"("branchId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "StockItem_organizationId_idx" ON "StockItem"("organizationId");

-- CreateIndex
CREATE INDEX "StockItem_branchId_idx" ON "StockItem"("branchId");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_idx" ON "StockMovement"("organizationId");

-- CreateIndex
CREATE INDEX "StockMovement_branchId_idx" ON "StockMovement"("branchId");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- CreateIndex
CREATE INDEX "Staff_organizationId_idx" ON "Staff"("organizationId");

-- CreateIndex
CREATE INDEX "Staff_branchId_idx" ON "Staff"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_staffId_key" ON "DoctorProfile"("staffId");

-- CreateIndex
CREATE INDEX "Consent_organizationId_idx" ON "Consent"("organizationId");

-- CreateIndex
CREATE INDEX "Consent_branchId_idx" ON "Consent"("branchId");

-- CreateIndex
CREATE INDEX "Consent_patientId_idx" ON "Consent"("patientId");

-- CreateIndex
CREATE INDEX "Survey_organizationId_idx" ON "Survey"("organizationId");

-- CreateIndex
CREATE INDEX "Survey_branchId_idx" ON "Survey"("branchId");

-- CreateIndex
CREATE INDEX "SurveyResponse_organizationId_idx" ON "SurveyResponse"("organizationId");

-- CreateIndex
CREATE INDEX "SurveyResponse_branchId_idx" ON "SurveyResponse"("branchId");

-- CreateIndex
CREATE INDEX "SurveyResponse_patientId_idx" ON "SurveyResponse"("patientId");

-- CreateIndex
CREATE INDEX "SurveyResponse_packageId_idx" ON "SurveyResponse"("packageId");

-- CreateIndex
CREATE INDEX "CommunicationLog_organizationId_idx" ON "CommunicationLog"("organizationId");

-- CreateIndex
CREATE INDEX "CommunicationLog_organizationId_direction_idx" ON "CommunicationLog"("organizationId", "direction");

-- CreateIndex
CREATE INDEX "CommunicationLog_branchId_idx" ON "CommunicationLog"("branchId");

-- CreateIndex
CREATE INDEX "CommunicationLog_patientId_idx" ON "CommunicationLog"("patientId");

-- CreateIndex
CREATE INDEX "CommunicationLog_channel_idx" ON "CommunicationLog"("channel");

-- CreateIndex
CREATE INDEX "Recall_organizationId_idx" ON "Recall"("organizationId");

-- CreateIndex
CREATE INDEX "Recall_branchId_idx" ON "Recall"("branchId");

-- CreateIndex
CREATE INDEX "Recall_dueDate_idx" ON "Recall"("dueDate");

-- CreateIndex
CREATE INDEX "ReportSnapshot_organizationId_idx" ON "ReportSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "ReportSnapshot_branchId_idx" ON "ReportSnapshot"("branchId");

-- CreateIndex
CREATE INDEX "DemoRequest_organizationId_idx" ON "DemoRequest"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_idx" ON "AuditLog"("branchId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_module_idx" ON "AuditLog"("module");

-- CreateIndex
CREATE INDEX "Lead_organizationId_idx" ON "Lead"("organizationId");

-- CreateIndex
CREATE INDEX "Lead_branchId_idx" ON "Lead"("branchId");

-- CreateIndex
CREATE INDEX "Lead_sourceChannel_idx" ON "Lead"("sourceChannel");

-- CreateIndex
CREATE INDEX "Lead_leadStatus_idx" ON "Lead"("leadStatus");

-- CreateIndex
CREATE INDEX "Lead_country_idx" ON "Lead"("country");

-- CreateIndex
CREATE INDEX "Lead_phone_idx" ON "Lead"("phone");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "LeadMessage_organizationId_idx" ON "LeadMessage"("organizationId");

-- CreateIndex
CREATE INDEX "LeadMessage_branchId_idx" ON "LeadMessage"("branchId");

-- CreateIndex
CREATE INDEX "LeadMessage_leadId_idx" ON "LeadMessage"("leadId");

-- CreateIndex
CREATE INDEX "LeadMessage_channel_idx" ON "LeadMessage"("channel");

-- CreateIndex
CREATE UNIQUE INDEX "TourismPackage_publicToken_key" ON "TourismPackage"("publicToken");

-- CreateIndex
CREATE INDEX "TourismPackage_organizationId_idx" ON "TourismPackage"("organizationId");

-- CreateIndex
CREATE INDEX "TourismPackage_branchId_idx" ON "TourismPackage"("branchId");

-- CreateIndex
CREATE INDEX "TourismPackage_leadId_idx" ON "TourismPackage"("leadId");

-- CreateIndex
CREATE INDEX "TourismPackage_packageStatus_idx" ON "TourismPackage"("packageStatus");

-- CreateIndex
CREATE INDEX "TreatmentPackageItem_organizationId_idx" ON "TreatmentPackageItem"("organizationId");

-- CreateIndex
CREATE INDEX "TreatmentPackageItem_packageId_idx" ON "TreatmentPackageItem"("packageId");

-- CreateIndex
CREATE INDEX "HotelPartner_organizationId_idx" ON "HotelPartner"("organizationId");

-- CreateIndex
CREATE INDEX "HotelPartner_active_idx" ON "HotelPartner"("active");

-- CreateIndex
CREATE INDEX "TransferPartner_organizationId_idx" ON "TransferPartner"("organizationId");

-- CreateIndex
CREATE INDEX "TransferPartner_active_idx" ON "TransferPartner"("active");

-- CreateIndex
CREATE INDEX "ReservationShare_organizationId_idx" ON "ReservationShare"("organizationId");

-- CreateIndex
CREATE INDEX "ReservationShare_packageId_idx" ON "ReservationShare"("packageId");

-- CreateIndex
CREATE INDEX "ReservationShare_leadId_idx" ON "ReservationShare"("leadId");

-- CreateIndex
CREATE INDEX "ReservationShare_status_idx" ON "ReservationShare"("status");

-- CreateIndex
CREATE INDEX "FollowUpSequence_organizationId_idx" ON "FollowUpSequence"("organizationId");

-- CreateIndex
CREATE INDEX "FollowUpSequence_active_idx" ON "FollowUpSequence"("active");

-- CreateIndex
CREATE INDEX "LeadFollowUp_organizationId_idx" ON "LeadFollowUp"("organizationId");

-- CreateIndex
CREATE INDEX "LeadFollowUp_leadId_idx" ON "LeadFollowUp"("leadId");

-- CreateIndex
CREATE INDEX "LeadFollowUp_status_idx" ON "LeadFollowUp"("status");

-- CreateIndex
CREATE INDEX "LeadFollowUp_nextRunAt_idx" ON "LeadFollowUp"("nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostTreatmentFollowUp_publicToken_key" ON "PostTreatmentFollowUp"("publicToken");

-- CreateIndex
CREATE INDEX "PostTreatmentFollowUp_organizationId_idx" ON "PostTreatmentFollowUp"("organizationId");

-- CreateIndex
CREATE INDEX "PostTreatmentFollowUp_patientId_idx" ON "PostTreatmentFollowUp"("patientId");

-- CreateIndex
CREATE INDEX "PostTreatmentFollowUp_packageId_idx" ON "PostTreatmentFollowUp"("packageId");

-- CreateIndex
CREATE INDEX "PostTreatmentFollowUp_status_idx" ON "PostTreatmentFollowUp"("status");

-- CreateIndex
CREATE INDEX "ReviewRequest_organizationId_idx" ON "ReviewRequest"("organizationId");

-- CreateIndex
CREATE INDEX "ReviewRequest_patientId_idx" ON "ReviewRequest"("patientId");

-- CreateIndex
CREATE INDEX "ReviewRequest_packageId_idx" ON "ReviewRequest"("packageId");

-- CreateIndex
CREATE INDEX "ReviewRequest_status_idx" ON "ReviewRequest"("status");

-- CreateIndex
CREATE INDEX "BeforeAfterCase_organizationId_idx" ON "BeforeAfterCase"("organizationId");

-- CreateIndex
CREATE INDEX "BeforeAfterCase_patientId_idx" ON "BeforeAfterCase"("patientId");

-- CreateIndex
CREATE INDEX "BeforeAfterCase_treatmentType_idx" ON "BeforeAfterCase"("treatmentType");

-- CreateIndex
CREATE INDEX "BeforeAfterCase_status_idx" ON "BeforeAfterCase"("status");

-- CreateIndex
CREATE INDEX "ConsentTemplate_organizationId_idx" ON "ConsentTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "ConsentTemplate_language_idx" ON "ConsentTemplate"("language");

-- CreateIndex
CREATE INDEX "ConsentTemplate_active_idx" ON "ConsentTemplate"("active");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalConsent_publicToken_key" ON "DigitalConsent"("publicToken");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalConsent_sourceConsentId_key" ON "DigitalConsent"("sourceConsentId");

-- CreateIndex
CREATE INDEX "DigitalConsent_organizationId_idx" ON "DigitalConsent"("organizationId");

-- CreateIndex
CREATE INDEX "DigitalConsent_patientId_idx" ON "DigitalConsent"("patientId");

-- CreateIndex
CREATE INDEX "DigitalConsent_leadId_idx" ON "DigitalConsent"("leadId");

-- CreateIndex
CREATE INDEX "DigitalConsent_status_idx" ON "DigitalConsent"("status");

-- CreateIndex
CREATE INDEX "SurveyTemplate_organizationId_idx" ON "SurveyTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "SurveyTemplate_language_idx" ON "SurveyTemplate"("language");

-- CreateIndex
CREATE INDEX "SurveyTemplate_active_idx" ON "SurveyTemplate"("active");

-- CreateIndex
CREATE INDEX "ChatbotKnowledgeBase_organizationId_idx" ON "ChatbotKnowledgeBase"("organizationId");

-- CreateIndex
CREATE INDEX "ChatbotKnowledgeBase_language_idx" ON "ChatbotKnowledgeBase"("language");

-- CreateIndex
CREATE INDEX "ChatbotKnowledgeBase_category_idx" ON "ChatbotKnowledgeBase"("category");

-- CreateIndex
CREATE INDEX "ChatConversation_organizationId_idx" ON "ChatConversation"("organizationId");

-- CreateIndex
CREATE INDEX "ChatConversation_leadId_idx" ON "ChatConversation"("leadId");

-- CreateIndex
CREATE INDEX "ChatConversation_status_idx" ON "ChatConversation"("status");

-- CreateIndex
CREATE INDEX "ChatMessage_organizationId_idx" ON "ChatMessage"("organizationId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId");

-- CreateIndex
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Task_organizationId_idx" ON "Task"("organizationId");

-- CreateIndex
CREATE INDEX "Task_assignedToUserId_idx" ON "Task"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Task_relatedLeadId_idx" ON "Task"("relatedLeadId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_priority_idx" ON "Task"("priority");

-- CreateIndex
CREATE INDEX "IntegrationLog_organizationId_idx" ON "IntegrationLog"("organizationId");

-- CreateIndex
CREATE INDEX "IntegrationLog_provider_idx" ON "IntegrationLog"("provider");

-- CreateIndex
CREATE INDEX "IntegrationLog_status_idx" ON "IntegrationLog"("status");

-- CreateIndex
CREATE INDEX "IntegrationLog_eventType_idx" ON "IntegrationLog"("eventType");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFile" ADD CONSTRAINT "PatientFile_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientFile" ADD CONSTRAINT "PatientFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recall" ADD CONSTRAINT "Recall_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoRequest" ADD CONSTRAINT "DemoRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
