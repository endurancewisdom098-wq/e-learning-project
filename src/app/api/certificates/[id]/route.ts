 import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ----------------------------------------------------------------------
// GET: Fetch Certificate Details or Verify Authenticity
// Endpoint: /api/certificates/[id]
// Supports searching by ID (UUID) or Certificate Code
// ----------------------------------------------------------------------
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Search by Certificate ID or unique Certificate Code
    const certificate = await prisma.certificate.findFirst({
      where: {
        OR: [
          { id: id },
          { certificateCode: id },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            instructor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!certificate) {
      return NextResponse.json(
        { error: "Certificate not found or invalid certificate code." },
        { status: 404 }
      );
    }

    if (certificate.isRevoked) {
      return NextResponse.json(
        { error: "This certificate has been revoked.", isRevoked: true },
        { status: 410 }
      );
    }

    // Format output for front-end rendering or PDF generation
    const responseData = {
      id: certificate.id,
      certificateCode: certificate.certificateCode,
      issueDate: certificate.issueDate,
      pdfUrl: certificate.pdfUrl,
      studentName: `${certificate.user.firstName} ${certificate.user.lastName}`,
      studentEmail: certificate.user.email,
      courseTitle: certificate.course.title,
      instructorName: `${certificate.course.instructor.firstName} ${certificate.course.instructor.lastName}`,
      isValid: true,
    };

    return NextResponse.json({ certificate: responseData }, { status: 200 });
  } catch (error: any) {
    console.error("[GET_CERTIFICATE_BY_ID_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to fetch certificate.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// PATCH: Revoke or Update Certificate Metadata (Admin/Instructor Only)
// Endpoint: /api/certificates/[id]
// ----------------------------------------------------------------------
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    const { isRevoked, pdfUrl, adminId } = body;

    if (!adminId) {
      return NextResponse.json(
        { error: "Admin or Instructor ID is required for validation." },
        { status: 400 }
      );
    }

    // Check if certificate exists
    const existingCertificate = await prisma.certificate.findUnique({
      where: { id },
    });

    if (!existingCertificate) {
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 }
      );
    }

    // Perform Update
    const updatedCertificate = await prisma.certificate.update({
      where: { id },
      data: {
        ...(isRevoked !== undefined && { isRevoked }),
        ...(pdfUrl && { pdfUrl }),
      },
    });

    return NextResponse.json(
      { message: "Certificate updated successfully.", certificate: updatedCertificate },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[UPDATE_CERTIFICATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to update certificate.", details: error.message },
      { status: 500 }
    );
  }
}

// ----------------------------------------------------------------------
// DELETE: Delete a Certificate permanently
// Endpoint: /api/certificates/[id]
// ----------------------------------------------------------------------
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const adminId = searchParams.get("adminId");

    if (!adminId) {
      return NextResponse.json(
        { error: "Query parameter 'adminId' is required." },
        { status: 400 }
      );
    }

    const existingCertificate = await prisma.certificate.findUnique({
      where: { id },
    });

    if (!existingCertificate) {
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 }
      );
    }

    await prisma.certificate.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Certificate deleted successfully." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE_CERTIFICATE_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to delete certificate.", details: error.message },
      { status: 500 }
    );
  }
}