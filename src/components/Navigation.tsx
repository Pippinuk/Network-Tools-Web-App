
import React, { useState } from 'react';
import { Menu, Network, Server } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import Logo from '@/components/Logo';
import { Link } from 'react-router-dom';

const Navigation = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2">
            <Menu className="size-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[250px] sm:w-[300px]">
          <SheetHeader className="mb-6">
            <SheetTitle>
              <Logo iconClassName="size-5" textClassName="text-lg" />
            </SheetTitle>
            <SheetDescription>
              Choose which tool you want to use
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-4">
            <Link 
              to="/" 
              className="flex items-center gap-3 rounded-md p-3 text-sm font-medium hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              <Network className="size-5" />
              <span>Subnet Slicer</span>
            </Link>
            <Link 
              to="/voss-config" 
              className="flex items-center gap-3 rounded-md p-3 text-sm font-medium hover:bg-accent"
              onClick={() => setOpen(false)}
            >
              <Server className="size-5" />
              <span>VOSS VRRP Generator</span>
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Navigation;
