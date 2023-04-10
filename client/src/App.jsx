import React, { useState, useEffect } from "react";
import { Box, Flex, Text, VStack, useToast, IconButton, Image } from "@chakra-ui/react";
import { ArrowForwardIcon } from "@chakra-ui/icon";
import Web3 from "web3";
import MetamaskLogo from "./metamaskicon.png";

const MENU_ITEMS = [
  "Accueil",
  "Recherche",
  "Profil",
  "Dashboard",
  "Mon Club",
  "Clubs",
  "Poster un call",
  "Staking",
  "Fondation",
];

function App() {
  const [currentMenuItem, setCurrentMenuItem] = useState("Accueil");
  const [account, setAccount] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (!window.ethereum) {
      toast({
        title: "Metamask non détecté",
        description: "Veuillez installer Metamask pour utiliser cette application",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }
  }, [toast]);

  const connectMetamask = async () => {
    if (window.ethereum) {
      const web3 = new Web3(window.ethereum);
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAccount(accounts[0]);
    }
  };

  const handleMenuItemClick = (menuItem) => {
    if (!account) {
      toast({
        title: "Non connecté",
        description: "Veuillez vous connecter avec Metamask pour naviguer",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    } else {
      setCurrentMenuItem(menuItem);
    }
  };

  return (
    <Flex>
      {/* Sidebar */}
      <VStack
        w="20%"
        h="100vh"
        borderRight="1px"
        borderColor="gray.200"
        alignItems="center"
        justifyContent="space-evenly"
      >
        <Text fontSize="2xl" fontWeight="bold">
          BetterCallClub
        </Text>
        {MENU_ITEMS.map((menuItem) => (
          <Text
            key={menuItem}
            onClick={() => handleMenuItemClick(menuItem)}
            cursor="pointer"
          >
            {menuItem}
          </Text>
        ))}
      </VStack>
      {/* Main Content */}
      <Box w="80%" p={8}>
        {account ? (
          <Text>
            Bienvenue sur Better Call Club, {currentMenuItem}
          </Text>
        ) : (
          <VStack spacing={4} alignItems="center">
            <Text fontSize="2xl">Bienvenue sur Better Call Club</Text>
            <IconButton
              icon={<ArrowForwardIcon />}
              onClick={connectMetamask}
              colorScheme="blue"
              isRound
            >
              Connexion Metamask
            </IconButton>
          </VStack>
        )}
      </Box>
      {/* Metamask Logo and Address */}
      {account && (
        <Flex
          position="fixed"
          top="1rem"
          right="1rem"
          alignItems="center"
          justifyContent="space-between"
        >
          <Text mr={2}>{account}</Text>
          <Image src={MetamaskLogo} boxSize="40px" />
        </Flex>
      )}
    </Flex>
  );
}

export default App;
