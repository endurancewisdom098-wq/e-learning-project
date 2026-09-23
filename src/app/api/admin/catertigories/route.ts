 import { NextResponse } from "next/server";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  courseCount: number;
  status: "active" | "archived";
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
}

export interface CategoriesApiResponse {
  categories: Category[];
  tags: Tag[];
}

// In-memory mock database store
let mockCategories: Category[] = [
  {
    id: "cat-1",
    name: "Web Development",
    slug: "web-development",
    description: "Frontend, backend, and fullstack web technologies.",
    courseCount: 42,
    status: "active",
    createdAt: "2025-01-15",
  },
  {
    id: "cat-2",
    name: "Data Science & AI",
    slug: "data-science-ai",
    description: "Machine learning, Python data pipelines, and neural networks.",
    courseCount: 28,
    status: "active",
    createdAt: "2025-02-01",
  },
  {
    id: "cat-3",
    name: "UI/UX Design",
    slug: "ui-ux-design",
    description: "Figma design systems, user research, and wireframing.",
    courseCount: 19,
    status: "active",
    createdAt: "2025-03-10",
  },
  {
    id: "cat-4",
    name: "Cloud & DevOps",
    slug: "cloud-devops",
    description: "Docker, Kubernetes, AWS infrastructure, and CI/CD.",
    courseCount: 14,
    status: "active",
    createdAt: "2025-04-05",
  },
  {
    id: "cat-5",
    name: "Legacy Mobile Apps",
    slug: "legacy-mobile-apps",
    description: "Deprecated Objective-C and old Android Java materials.",
    courseCount: 3,
    status: "archived",
    createdAt: "2024-11-20",
  },
];

let mockTags: Tag[] = [
  { id: "tag-1", name: "Next.js", slug: "nextjs", usageCount: 38 },
  { id: "tag-2", name: "TypeScript", slug: "typescript", usageCount: 45 },
  { id: "tag-3", name: "Tailwind CSS", slug: "tailwindcss", usageCount: 29 },
  { id: "tag-4", name: "Python", slug: "python", usageCount: 31 },
  { id: "tag-5", name: "Docker", slug: "docker", usageCount: 16 },
  { id: "tag-6", name: "Figma", slug: "figma", usageCount: 22 },
  { id: "tag-7", name: "GraphQL", slug: "graphql", usageCount: 11 },
];

export async function GET() {
  await new Promise((res) => setTimeout(res, 300));
  return NextResponse.json({
    categories: mockCategories,
    tags: mockTags,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { entityType, name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    if (entityType === "tag") {
      const newTag: Tag = {
        id: `tag-${Date.now()}`,
        name,
        slug,
        usageCount: 0,
      };
      mockTags.unshift(newTag);
      return NextResponse.json({ message: "Tag created", tag: newTag }, { status: 201 });
    }

    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name,
      slug,
      description: description || "No description provided.",
      courseCount: 0,
      status: "active",
      createdAt: new Date().toISOString().split("T")[0],
    };

    mockCategories.unshift(newCategory);
    return NextResponse.json(
      { message: "Category created", category: newCategory },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Category/Tag error:", error);
    return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, name, description, status } = body;

    const index = mockCategories.findIndex((c) => c.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const updatedCategory = {
      ...mockCategories[index],
      name: name ?? mockCategories[index].name,
      description: description ?? mockCategories[index].description,
      status: status ?? mockCategories[index].status,
      slug: name
        ? name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "")
        : mockCategories[index].slug,
    };

    mockCategories[index] = updatedCategory;
    return NextResponse.json({ message: "Category updated", category: updatedCategory });
  } catch (error) {
    console.error("PUT Category error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type") || "category";

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    if (type === "tag") {
      mockTags = mockTags.filter((t) => t.id !== id);
      return NextResponse.json({ message: "Tag deleted successfully" });
    }

    mockCategories = mockCategories.filter((c) => c.id !== id);
    return NextResponse.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("DELETE Category/Tag error:", error);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}